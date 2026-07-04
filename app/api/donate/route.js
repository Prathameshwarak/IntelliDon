// app/api/donate/route.js
// Public endpoint — no auth required
// Returns mandal name, active event, and UPI info for the donation page

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

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    // Fetch mandal by slug — must be active
    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .select('id, name, address, city, phone, status, slug')
      .eq('slug', slug)
      .single()

    if (mandalError || !mandal) {
      return NextResponse.json(
        { error: 'Organisation not found. Check your link.' },
        { status: 404 }
      )
    }

    if (mandal.status !== 'active') {
      return NextResponse.json(
        { error: 'This organisation is not currently accepting donations.' },
        { status: 403 }
      )
    }

    // Get the active event for this mandal
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, name, year, upi_id, upi_qr_url')
      .eq('mandal_id', mandal.id)
      .eq('is_active', true)
      .order('year', { ascending: false })
      .limit(1)

    if (eventsError || !events || events.length === 0) {
      return NextResponse.json(
        { error: 'No active event found for this organisation.' },
        { status: 404 }
      )
    }

    const event = events[0]

    // Don't expose internal IDs in the public response — only what's needed
    return NextResponse.json({
      mandal: {
        id: mandal.id,
        name: mandal.name,
        city: mandal.city,
        address: mandal.address
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