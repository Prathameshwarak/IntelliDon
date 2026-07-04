// app/api/donations/verify/route.js
// Updated — after verifying a upi_self donation, auto-generates the receipt PDF

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/generateReceiptPDF'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)


export async function PATCH(request) {
  try {
    const body = await request.json()
    const { donation_id, verified_by } = body

    if (!donation_id || !verified_by) {
      return NextResponse.json(
        { error: 'donation_id and verified_by are required' },
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
        { error: 'Only admin or manager can verify donations' },
        { status: 403 }
      )
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

    if (donation.status === 'verified') {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 })
    }

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from('donations')
      .update({
        status: 'verified',
        verified_by,
        verified_at: new Date().toISOString()
      })
      .eq('id', donation_id)

    if (updateError) {
      return NextResponse.json({ error: 'Could not verify donation' }, { status: 500 })
    }

    // For upi_self donations — generate receipt now (wasn't done at entry time)
    // For cash/upi_collector — receipt was already generated at entry, just return existing url
    let pdfUrl = donation.pdf_url

    if (donation.payment_mode === 'upi_self' && !pdfUrl) {
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
        // Don't fail the verify — just log
      }
    }

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl || null
    })

  } catch (err) {
    console.error('Unexpected error in verify:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
