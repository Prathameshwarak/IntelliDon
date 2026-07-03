import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET — fetch all events for a mandal
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mandal_id = searchParams.get('mandal_id')

  if (!mandal_id) {
    return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
  }

  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('mandal_id', mandal_id)
    .order('year', { ascending: false })

  if (error) return NextResponse.json({ error: 'Could not fetch events' }, { status: 500 })

  return NextResponse.json({ events })
}

// POST — create a new event
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, name, year, upi_id, upi_qr_url } = body

    if (!mandal_id || !name || !year) {
      return NextResponse.json({ error: 'mandal_id, name and year are required' }, { status: 400 })
    }

    // Check mandal is active
    const { data: mandal } = await supabaseAdmin
      .from('mandals')
      .select('status')
      .eq('id', mandal_id)
      .single()

    if (!mandal || mandal.status !== 'active') {
      return NextResponse.json({ error: 'Mandal is not active' }, { status: 403 })
    }

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({ mandal_id, name, year: parseInt(year), upi_id: upi_id || null, upi_qr_url: upi_qr_url || null, is_active: true })
      .select()
      .single()

    if (error) {
      console.error('Event insert error:', error)
      return NextResponse.json({ error: 'Could not create event' }, { status: 500 })
    }

    return NextResponse.json({ success: true, event })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH — toggle event active/inactive
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { event_id, is_active } = body

    if (!event_id || is_active === undefined) {
      return NextResponse.json({ error: 'event_id and is_active are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('events')
      .update({ is_active })
      .eq('id', event_id)

    if (error) return NextResponse.json({ error: 'Could not update event' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}