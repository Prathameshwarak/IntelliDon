// app/api/donations/[id]/receipt/route.js
// POST — generates PDF receipt for a donation and stores it in Supabase storage
// GET  — returns the existing download URL for a receipt

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/generateReceiptPDF'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── GET — return existing receipt URL ─────────────────────────
export async function GET(request, { params }) {
  try {
    const { id } = await params

    const { data: donation, error } = await supabaseAdmin
      .from('donations')
      .select('id, receipt_number, pdf_url, status')
      .eq('id', id)
      .single()

    if (error || !donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    if (!donation.pdf_url) {
      return NextResponse.json({ error: 'Receipt not yet generated' }, { status: 404 })
    }

    return NextResponse.json({
      receipt_number: donation.receipt_number,
      pdf_url: donation.pdf_url
    })

  } catch (err) {
    console.error('GET receipt error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ── POST — generate and store the PDF ─────────────────────────
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
        pdf_url,
        created_at,
        collected_by,
        mandal_id,
        mandals (
          id,
          name,
          address,
          city,
          phone
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

    // 3. If PDF already exists, just return the existing URL — don't regenerate
    if (donation.pdf_url) {
      return NextResponse.json({
        success: true,
        receipt_number: donation.receipt_number,
        pdf_url: donation.pdf_url,
        already_existed: true
      })
    }

    // 4. Generate the PDF bytes
    const mandal = donation.mandals
    const event = donation.events
    const collector = donation.users

    const pdfBytes = await generateReceiptPDF({
      receiptNumber:  donation.receipt_number,
      mandalName:     mandal.name,
      mandalAddress:  [mandal.address, mandal.city].filter(Boolean).join(', '),
      mandalPhone:    mandal.phone,
      eventName:      `${event.name} ${event.year}`,
      donorName:      donation.donor_name,
      donorPhone:     donation.donor_phone,
      donorAddress:   donation.donor_address,
      amount:         donation.amount,
      paymentMode:    donation.payment_mode,
      createdAt:      donation.created_at,
      collectedBy:    collector?.full_name || null
    })

    // 5. Upload PDF to Supabase storage — receipts bucket
    // File path: receipts/{mandal_id}/{receipt_number}.pdf
    const filePath = `${mandal.id}/${donation.receipt_number}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('receipts')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true  // overwrite if regenerating
      })

    if (uploadError) {
      console.error('PDF upload error:', uploadError)
      return NextResponse.json({ error: 'Could not store receipt PDF' }, { status: 500 })
    }

    // 6. Get the public URL (receipts bucket is public)
    const { data: urlData } = supabaseAdmin.storage
      .from('receipts')
      .getPublicUrl(filePath)

    const pdfUrl = urlData.publicUrl

    // 7. Save the URL back to the donation row
    const { error: updateError } = await supabaseAdmin
      .from('donations')
      .update({ pdf_url: pdfUrl })
      .eq('id', id)

    if (updateError) {
      console.error('PDF URL update error:', updateError)
      // Don't fail — PDF is already uploaded, just log the error
    }

    return NextResponse.json({
      success: true,
      receipt_number: donation.receipt_number,
      pdf_url: pdfUrl
    })

  } catch (err) {
    console.error('POST receipt error:', err)
    return NextResponse.json({ error: 'Something went wrong generating the receipt' }, { status: 500 })
  }
}