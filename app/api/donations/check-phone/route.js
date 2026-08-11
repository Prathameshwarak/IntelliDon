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

    // Event name and existing-donation lookup are independent of each
    // other, so fetch them concurrently instead of one after another.
    const [{ data: event }, { data: existing }] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('name, year')
        .eq('id', event_id)
        .single(),
      supabaseAdmin
        .from('donations')
        .select('receipt_number')
        .eq('event_id', event_id)
        .eq('donor_phone', phone.trim())
        .maybeSingle()
    ])

    const eventName = event ? `${event.name} ${event.year}` : 'this event'

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
