import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const event_id = searchParams.get('event_id')
    const phone = searchParams.get('phone')

    if (!event_id || !phone) {
      return NextResponse.json({ error: 'Missing event_id or phone' }, { status: 400 })
    }

    // Get event name
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('name, year')
      .eq('id', event_id)
      .single()

    const eventName = event ? `${event.name} ${event.year}` : 'this event'

    // Check existing donation
    const { data: existing } = await supabaseAdmin
      .from('donations')
      .select('receipt_number')
      .eq('event_id', event_id)
      .eq('donor_phone', phone.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        exists: true,
        receipt_id: existing.receipt_number,
        event_name: eventName
      })
    }

    return NextResponse.json({ exists: false })
  } catch (err) {
    console.error('Check phone duplicate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
