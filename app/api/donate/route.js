// app/api/donate/route.js
// Public endpoint — no auth required
// Returns mandal name, active event, UPI info, and logo for the donation page

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug || slug === 'undefined' || slug === 'null') {
      return NextResponse.json({ error: 'Valid slug or mandal ID is required' }, { status: 400 })
    }

    // 1. Fetch mandal by slug OR by ID
    let mandal = null

    const selectFields = 'id, name, address, city, phone, admin_email, status, slug, doc_logo'
    
    // First try exact slug match
    const { data: bySlug } = await supabaseAdmin
      .from('mandals')
      .select(selectFields)
      .eq('slug', slug)
      .maybeSingle()

    if (bySlug) {
      mandal = bySlug
    } else {
      // Second try by mandal UUID ID
      const { data: byId } = await supabaseAdmin
        .from('mandals')
        .select(selectFields)
        .eq('id', slug)
        .maybeSingle()

      if (byId) {
        mandal = byId
      } else {
        // Third try case-insensitive slug match
        const { data: byIlike } = await supabaseAdmin
          .from('mandals')
          .select(selectFields)
          .ilike('slug', slug)
          .maybeSingle()

        if (byIlike) mandal = byIlike
      }
    }

    if (!mandal) {
      return NextResponse.json(
        { error: 'Organisation not found. Check your link.' },
        { status: 404 }
      )
    }

    // Resolve doc_logo into a base64 Data URL so the browser can embed it into PDF receipts without CORS blocks
    let docLogoUrl = null
    if (mandal.doc_logo) {
      if (mandal.doc_logo.startsWith('data:')) {
        docLogoUrl = mandal.doc_logo
      } else if (mandal.doc_logo.startsWith('http://') || mandal.doc_logo.startsWith('https://')) {
        try {
          const res = await fetch(mandal.doc_logo)
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer()
            const contentType = res.headers.get('content-type') || 'image/png'
            docLogoUrl = `data:${contentType};base64,${Buffer.from(arrayBuf).toString('base64')}`
          } else {
            docLogoUrl = mandal.doc_logo
          }
        } catch {
          docLogoUrl = mandal.doc_logo
        }
      } else {
        try {
          // Download directly from 'kyc-documents' bucket (or 'mandal-docs' fallback) using service role admin
          let fileBlob = null
          const { data: kycBlob } = await supabaseAdmin.storage
            .from('kyc-documents')
            .download(mandal.doc_logo)

          if (kycBlob) {
            fileBlob = kycBlob
          } else {
            const { data: mandalBlob } = await supabaseAdmin.storage
              .from('mandal-docs')
              .download(mandal.doc_logo)
            fileBlob = mandalBlob
          }

          if (fileBlob) {
            const arrayBuf = await fileBlob.arrayBuffer()
            const isJpg = mandal.doc_logo.toLowerCase().endsWith('.jpg') || mandal.doc_logo.toLowerCase().endsWith('.jpeg')
            const mimeType = isJpg ? 'image/jpeg' : 'image/png'
            docLogoUrl = `data:${mimeType};base64,${Buffer.from(arrayBuf).toString('base64')}`
          }
        } catch (err) {
          console.warn('Could not download mandal logo buffer:', err)
        }

        // Fallback to signed URL if data URL generation fails
        if (!docLogoUrl) {
          try {
            const { data: signedLogo } = await supabaseAdmin.storage
              .from('kyc-documents')
              .createSignedUrl(mandal.doc_logo, 60 * 60 * 24 * 365)
            if (signedLogo?.signedUrl) docLogoUrl = signedLogo.signedUrl
          } catch (e) {
            console.warn('Could not sign mandal logo URL:', e)
          }
        }
      }
    }

    // 2. Fetch current live event:
    const today = new Date().toISOString().split('T')[0]
    let { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name, year, upi_id, upi_qr_url, is_active, is_suspended, start_date, end_date')
      .eq('mandal_id', mandal.id)
      .eq('is_active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('year', { ascending: false })

    events = (events || []).filter(e => !e.is_suspended)

    if (!events || events.length === 0) {
      return NextResponse.json(
        { error: 'No live or active event is currently available for this organisation. Please contact the organisation admin or manager.' },
        { status: 404 }
      )
    }

    const event = events[0]

    return NextResponse.json({
      mandal: {
        id: mandal.id,
        name: mandal.name,
        city: mandal.city,
        address: mandal.address,
        phone: mandal.phone,
        admin_email: mandal.admin_email,
        doc_logo: docLogoUrl
      },
      event: {
        id: event.id,
        name: event.name,
        year: event.year,
        upi_id: event.upi_id,
        upi_qr_url: event.upi_qr_url
      }
    })

  } catch (err) {
    console.error('Public donate API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}