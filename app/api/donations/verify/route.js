// app/api/donations/verify/route.js
// Updated — after verifying a upi_self donation, auto-generates the receipt PDF

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildReceiptData } from '@/lib/receiptData'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)


export async function PATCH(request) {
  try {
    const body = await request.json()
    const { donation_id, collector_id, payment_mode, status = 'verified', rejection_reason } = body

    // Authenticate token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }

    const verified_by = authUser.id

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

    // ── Mode 1: Bulk verification for a collector ───────────────────
    if (collector_id && payment_mode) {
      if (!['cash', 'upi_collector'].includes(payment_mode)) {
        return NextResponse.json({ error: 'Invalid payment mode for bulk verification' }, { status: 400 })
      }

      // Fetch pending donations for this collector and payment mode with joins
      const { data: pendingDonations, error: fetchErr } = await supabaseAdmin
        .from('donations')
        .select(`
          id,
          receipt_number,
          donor_name,
          donor_phone,
          donor_address,
          amount,
          payment_mode,
          created_at,
          mandal_id,
          mandals (
            id, name, address, city, phone, doc_logo
          ),
          events (
            id, name, year
          ),
          users!collected_by (
            full_name
          )
        `)
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

      // Bulk update per-row to generate receipt_data
      try {
        const verified_at = new Date().toISOString()

        // Cache signed logo URL for bulk performance if mandal has a logo
        let bulkLogoUrl = null
        const firstMandalLogo = pendingDonations[0]?.mandals?.doc_logo
        if (firstMandalLogo) {
          try {
            const { data: signedData } = await supabaseAdmin.storage
              .from('kyc-documents')
              .createSignedUrl(firstMandalLogo, 60 * 60 * 24 * 365)
            bulkLogoUrl = signedData?.signedUrl || null
          } catch (e) {
            console.warn('Bulk logo URL error:', e)
          }
        }

        const updatePromises = pendingDonations.map(async (donation) => {
          const receiptData = buildReceiptData({
            donation: {
              ...donation,
              verification_type: verifier.role,
              verified_at
            },
            mandal: donation.mandals,
            event: donation.events,
            collectorName: donation.users?.full_name,
            logoUrl: bulkLogoUrl
          })
          const { error } = await supabaseAdmin
            .from('donations')
            .update({
              status: 'verified',
              verified_by,
              verified_at,
              verification_type: verifier.role,
              receipt_data: receiptData
            })
            .eq('id', donation.id)
          if (error) throw error
        })
        await Promise.all(updatePromises)
      } catch (updateError) {
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
        created_at,
        mandal_id,
        mandals (
          id, name, address, city, phone, doc_logo
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

    let receiptData = null
    if (status === 'verified') {
      let singleLogoUrl = null
      if (donation.mandals?.doc_logo) {
        try {
          const { data: signedData } = await supabaseAdmin.storage
            .from('kyc-documents')
            .createSignedUrl(donation.mandals.doc_logo, 60 * 60 * 24 * 365)
          singleLogoUrl = signedData?.signedUrl || null
        } catch (e) {
          console.warn('Single logo URL error:', e)
        }
      }

      receiptData = buildReceiptData({
        donation: {
          ...donation,
          verification_type: verifier.role,
          verified_at: updateData.verified_at
        },
        mandal: donation.mandals,
        event: donation.events,
        collectorName: donation.users?.full_name,
        logoUrl: singleLogoUrl
      })
      updateData.receipt_data = receiptData
      updateData.verification_type = verifier.role
    }

    const { error: updateError } = await supabaseAdmin
      .from('donations')
      .update(updateData)
      .eq('id', donation_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Could not update donation status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status,
      receipt_data: receiptData
    })

  } catch (err) {
    console.error('Unexpected error in verify:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
