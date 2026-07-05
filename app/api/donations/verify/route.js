// app/api/donations/verify/route.js
// Updated — after verifying a upi_self donation, auto-generates the receipt PDF

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/generateReceiptPDF'
import { canUseFeature } from '@/lib/subscription'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)


export async function PATCH(request) {
  try {
    const body = await request.json()
    const { donation_id, collector_id, payment_mode, verified_by, status = 'verified', rejection_reason } = body

    if (!verified_by) {
      return NextResponse.json(
        { error: 'verified_by is required' },
        { status: 400 }
      )
    }

    // Confirm the verifier is admin or manager
    const { data: verifier, error: verifierError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', verified_by)
      .single()

    if (verifierError || !verifier) {
      return NextResponse.json({ error: 'Verifier not found' }, { status: 404 })
    }

    if (!['admin', 'manager'].includes(verifier.role)) {
      return NextResponse.json(
        { error: 'Only admin or manager can verify or reject donations' },
        { status: 403 }
      )
    }

    const isSubscribed = await canUseFeature(verifier.mandal_id, 'donations')
    if (!isSubscribed) {
      return NextResponse.json({ error: 'Subscription expired or inactive. Upgrade to verify donations.' }, { status: 403 })
    }

    // ── Mode 1: Bulk verification for a collector ───────────────────
    if (collector_id && payment_mode) {
      if (!['cash', 'upi_collector'].includes(payment_mode)) {
        return NextResponse.json({ error: 'Invalid payment mode for bulk verification' }, { status: 400 })
      }

      // Fetch pending donations for this collector and payment mode
      const { data: pendingDonations, error: fetchErr } = await supabaseAdmin
        .from('donations')
        .select('id')
        .eq('collected_by', collector_id)
        .eq('payment_mode', payment_mode)
        .eq('status', 'pending')
        .eq('mandal_id', verifier.mandal_id)

      if (fetchErr) {
        console.error('Fetch pending donations error:', fetchErr)
        return NextResponse.json({ error: 'Could not fetch pending donations' }, { status: 500 })
      }

      if (!pendingDonations || pendingDonations.length === 0) {
        return NextResponse.json({ error: 'No pending donations found to verify' }, { status: 400 })
      }

      const donationIds = pendingDonations.map(d => d.id)

      // Bulk update
      const { error: updateError } = await supabaseAdmin
        .from('donations')
        .update({
          status: 'verified',
          verified_by,
          verified_at: new Date().toISOString()
        })
        .in('id', donationIds)

      if (updateError) {
        console.error('Bulk update error:', updateError)
        return NextResponse.json({ error: 'Could not bulk verify donations' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        verified_ids: donationIds
      })
    }

    // ── Mode 2: Single donation verification or rejection ──────────
    if (!donation_id) {
      return NextResponse.json(
        { error: 'donation_id or (collector_id and payment_mode) is required' },
        { status: 400 }
      )
    }

    if (!['verified', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    // Fetch full donation with related data
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .select(`
        id,
        receipt_number,
        donor_name,
        donor_phone,
        donor_address,
        amount,
        payment_mode,
        status,
        pdf_url,
        created_at,
        mandal_id,
        mandals (
          id, name, address, city, phone
        ),
        events (
          id, name, year
        ),
        users!collected_by (
          full_name
        )
      `)
      .eq('id', donation_id)
      .single()

    if (donationError || !donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    if (donation.mandal_id !== verifier.mandal_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (donation.status === 'verified' && status === 'verified') {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 })
    }

    // Update status and optional rejection reason
    const updateData = {
      status,
      verified_by,
      verified_at: new Date().toISOString()
    }
    if (status === 'rejected') {
      updateData.rejection_reason = rejection_reason || 'No reason provided'
    } else {
      updateData.rejection_reason = null // Clear if verified
    }

    const { error: updateError } = await supabaseAdmin
      .from('donations')
      .update(updateData)
      .eq('id', donation_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Could not update donation status' }, { status: 500 })
    }

    // For upi_self donations — generate receipt now (wasn't done at entry time)
    // For cash/upi_collector — receipt was already generated at entry, just return existing url
    let pdfUrl = donation.pdf_url

    if (status === 'verified' && donation.payment_mode === 'upi_self' && !pdfUrl) {
      try {
        const mandal = donation.mandals
        const event = donation.events
        const collector = donation.users

        const pdfBytes = await generateReceiptPDF({
          receiptNumber: donation.receipt_number,
          mandalName:    mandal.name,
          mandalAddress: [mandal.address, mandal.city].filter(Boolean).join(', '),
          mandalPhone:   mandal.phone,
          eventName:     `${event.name} ${event.year}`,
          donorName:     donation.donor_name,
          donorPhone:    donation.donor_phone,
          donorAddress:  donation.donor_address,
          amount:        donation.amount,
          paymentMode:   donation.payment_mode,
          createdAt:     donation.created_at,
          collectedBy:   collector?.full_name || null
        })

        const filePath = `${mandal.id}/${donation.receipt_number}.pdf`

        const { error: uploadError } = await supabaseAdmin.storage
          .from('receipts')
          .upload(filePath, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true
          })

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from('receipts')
            .getPublicUrl(filePath)

          pdfUrl = urlData.publicUrl

          await supabaseAdmin
            .from('donations')
            .update({ pdf_url: pdfUrl })
            .eq('id', donation_id)
        }
      } catch (pdfErr) {
        console.error('PDF generation on verify error:', pdfErr)
      }
    }

    return NextResponse.json({
      success: true,
      status,
      pdf_url: status === 'verified' ? (pdfUrl || null) : null
    })

  } catch (err) {
    console.error('Unexpected error in verify:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
