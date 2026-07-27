// app/api/donations/[id]/receipt/route.js
// GET  — returns the existing receipt_data for a receipt
// POST — backfills receipt_data for historical donations verified before this change existed

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildReceiptData } from '@/lib/receiptData'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── GET — return existing receipt data ─────────────────────────
export async function GET(request, { params }) {
  try {
    const { id } = await params

    const { data: donation, error } = await supabaseAdmin
      .from('donations')
      .select('id, receipt_number, receipt_data, status')
      .eq('id', id)
      .single()

    if (error || !donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    if (!donation.receipt_data) {
      return NextResponse.json({ error: 'Receipt not yet generated' }, { status: 404 })
    }

    return NextResponse.json({
      receipt_number: donation.receipt_number,
      receipt_data: donation.receipt_data
    })

  } catch (err) {
    console.error('GET receipt error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ── POST — backfill receipt_data ──────────────────────────────
export async function POST(request, { params }) {
  try {
    const { id } = await params

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

    // 1. Fetch the donation with all related data needed for the receipt
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
        receipt_data,
        created_at,
        verified_at,
        verification_type,
        collected_by,
        mandal_id,
        mandals (
          id,
          name,
          address,
          city,
          phone,
          doc_logo
        ),
        events (
          id,
          name,
          year
        ),
        users!collected_by (
          full_name
        )
      `)
      .eq('id', id)
      .single()

    if (donationError || !donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', authUser.id)
      .single()

    if (!profile || profile.mandal_id !== donation.mandal_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Only generate receipts for verified donations
    if (donation.status !== 'verified') {
      return NextResponse.json(
        { error: 'Receipt can only be generated after donation is verified' },
        { status: 400 }
      )
    }

    // 3. If receipt_data already exists, just return it
    if (donation.receipt_data) {
      return NextResponse.json({
        success: true,
        receipt_number: donation.receipt_number,
        receipt_data: donation.receipt_data,
        already_existed: true
      })
    }

    // 4. Build receipt data
    const mandal = donation.mandals
    const event = donation.events
    const collector = donation.users

    let logoUrl = null
    if (mandal?.doc_logo) {
      try {
        const { data: signedData } = await supabaseAdmin.storage
          .from('kyc-documents')
          .createSignedUrl(mandal.doc_logo, 60 * 60 * 24 * 365)
        logoUrl = signedData?.signedUrl || null
      } catch (e) {
        console.warn('Signed logo URL error:', e)
      }
    }

    const receiptData = buildReceiptData({
      donation,
      mandal,
      event,
      collectorName: collector?.full_name || null,
      logoUrl
    })

    // 5. Save the receipt_data back to the donation row
    const { error: updateError } = await supabaseAdmin
      .from('donations')
      .update({ receipt_data: receiptData })
      .eq('id', id)

    if (updateError) {
      console.error('Receipt data update error:', updateError)
      return NextResponse.json({ error: 'Could not update receipt data' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      receipt_number: donation.receipt_number,
      receipt_data: receiptData
    })

  } catch (err) {
    console.error('POST receipt error:', err)
    return NextResponse.json({ error: 'Something went wrong backfilling the receipt' }, { status: 500 })
  }
}