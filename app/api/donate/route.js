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

    if (!slug || slug === 'undefined' || slug === 'null') {
      return NextResponse.json({ error: 'Valid slug or mandal ID is required' }, { status: 400 })
    }

    // 1. Fetch mandal by slug OR by ID
    let mandal = null
    
    // First try exact slug match
    const { data: bySlug } = await supabaseAdmin
      .from('mandals')
      .select('id, name, address, city, phone, status, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (bySlug) {
      mandal = bySlug
    } else {
      // Second try by mandal UUID ID
      const { data: byId } = await supabaseAdmin
        .from('mandals')
        .select('id, name, address, city, phone, status, slug')
        .eq('id', slug)
        .maybeSingle()

      if (byId) {
        mandal = byId
      } else {
        // Third try case-insensitive slug match
        const { data: byIlike } = await supabaseAdmin
          .from('mandals')
          .select('id, name, address, city, phone, status, slug')
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