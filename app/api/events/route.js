import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Validation helpers ────────────────────────────────────────
function validateEventFields({ name, year, upi_id, start_date, end_date, isEdit, existingStartDate }) {
  if (!name || !name.trim()) return 'Event name is required'
  if (!year) return 'Year is required'
  if (!upi_id || !upi_id.trim()) return 'UPI ID is required'
  if (!start_date) return 'Start date is required'
  if (!end_date) return 'End date is required'

  const start = new Date(start_date)
  const end = new Date(end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isNaN(start.getTime())) return 'Start date is invalid'
  if (isNaN(end.getTime())) return 'End date is invalid'
  if (end <= start) return 'End date must be after start date'

  const durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24))
  if (durationDays > 50) return `Event duration cannot exceed 50 days (you entered ${durationDays} days)`

  if (!isEdit && start < today) return 'Start date cannot be in the past'
  if (isEdit && start_date !== existingStartDate && start < today) return 'Start date cannot be in the past'

  return null // no error
}

// ── GET — fetch all events for a mandal ───────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mandal_id = searchParams.get('mandal_id')

  if (!mandal_id) {
    return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
  }

  // Auto-deactivate any events that have passed their end_date before returning
  const today = new Date().toISOString().split('T')[0]
  await supabaseAdmin
    .from('events')
    .update({ is_active: false })
    .eq('mandal_id', mandal_id)
    .lt('end_date', today)
    .eq('is_active', true)

  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('mandal_id', mandal_id)
    .order('start_date', { ascending: false })

  if (error) return NextResponse.json({ error: 'Could not fetch events' }, { status: 500 })

  // Add a human-readable status to each event
  const enriched = events.map(ev => ({
    ...ev,
    is_expired: ev.end_date < today,
    days_remaining: ev.end_date >= today
      ? Math.ceil((new Date(ev.end_date) - new Date(today)) / (1000 * 60 * 60 * 24))
      : 0
  }))

  return NextResponse.json({ events: enriched })
}

// ── POST — create a new event ─────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, name, year, upi_id, start_date, end_date } = body

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    // Validate all fields
    const validationError = validateEventFields({ name, year, upi_id, start_date, end_date })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
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

    // Determine initial is_active — true only if start_date is today or past
    const today = new Date().toISOString().split('T')[0]
    const isActiveNow = start_date <= today

    if (isActiveNow) {
      // Deactivate all other active events for this mandal since only a single event can be active
      await supabaseAdmin
        .from('events')
        .update({ is_active: false })
        .eq('mandal_id', mandal_id)
    }

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({
        mandal_id,
        name: name.trim(),
        year: parseInt(year),
        upi_id: upi_id.trim(),
        start_date,
        end_date,
        is_active: isActiveNow
      })
      .select()
      .single()

    if (error) {
      console.error('Event insert error:', error)
      // Surface DB constraint violations cleanly
      if (error.message.includes('events_max_50_days')) {
        return NextResponse.json({ error: 'Event duration cannot exceed 50 days' }, { status: 400 })
      }
      if (error.message.includes('events_end_after_start')) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Could not create event' }, { status: 500 })
    }

    // Enrich the newly created event with computed values
    const enriched = {
      ...event,
      is_expired: event.end_date < today,
      days_remaining: event.end_date >= today
        ? Math.ceil((new Date(event.end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    }

    return NextResponse.json({ success: true, event: enriched })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// ── PATCH — toggle active/inactive (respects end_date) ────────
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { event_id, is_active } = body

    if (!event_id || is_active === undefined) {
      return NextResponse.json({ error: 'event_id and is_active are required' }, { status: 400 })
    }

    // Fetch event to check dates before allowing toggle
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('end_date, start_date, is_active, mandal_id, is_suspended')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0]

    // Cannot activate a suspended event
    if (is_active === true && event.is_suspended) {
      return NextResponse.json(
        { error: 'This event is suspended and cannot be activated' },
        { status: 403 }
      )
    }

    // Cannot reactivate an expired event
    if (is_active === true && event.end_date < today) {
      return NextResponse.json(
        { error: 'This event has passed its end date and cannot be reactivated' },
        { status: 400 }
      )
    }

    // Cannot activate before start date
    if (is_active === true && event.start_date > today) {
      return NextResponse.json(
        { error: `Could not activate event because the start date is in the future (starts on ${event.start_date})` },
        { status: 400 }
      )
    }

    if (is_active === true) {
      // Deactivate all other active events for this mandal since only a single event can be active
      await supabaseAdmin
        .from('events')
        .update({ is_active: false })
        .eq('mandal_id', event.mandal_id)
        .neq('id', event_id)
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

// ── PUT — edit an existing event ──────────────────────────────
export async function PUT(request) {
  try {
    const body = await request.json()
    const { event_id, name, year, upi_id, start_date, end_date } = body

    if (!event_id) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
    }

    // Fetch existing event
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Cannot edit a suspended event
    if (event.is_suspended) {
      return NextResponse.json({ error: 'This event is suspended and cannot be edited' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]

    // Cannot edit an expired event
    if (event.end_date < today) {
      return NextResponse.json({ error: 'Expired events cannot be edited' }, { status: 400 })
    }

    // Validate fields
    const validationError = validateEventFields({
      name,
      year,
      upi_id,
      start_date,
      end_date,
      isEdit: true,
      existingStartDate: event.start_date
    })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Determine if is_active needs to be adjusted
    // If start_date is updated to be in the future, it should be set to active: false.
    let nextActive = event.is_active
    if (start_date > today) {
      nextActive = false
    }

    // If it becomes active, deactivate other events for this mandal
    if (nextActive === true && event.is_active === false) {
      await supabaseAdmin
        .from('events')
        .update({ is_active: false })
        .eq('mandal_id', event.mandal_id)
        .neq('id', event_id)
    }

    const { data: updatedEvent, error } = await supabaseAdmin
      .from('events')
      .update({
        name: name.trim(),
        year: parseInt(year),
        upi_id: upi_id.trim(),
        start_date,
        end_date,
        is_active: nextActive
      })
      .eq('id', event_id)
      .select()
      .single()

    if (error) {
      console.error('Event update error:', error)
      if (error.message.includes('events_max_50_days')) {
        return NextResponse.json({ error: 'Event duration cannot exceed 50 days' }, { status: 400 })
      }
      if (error.message.includes('events_end_after_start')) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Could not update event' }, { status: 500 })
    }

    const enriched = {
      ...updatedEvent,
      is_expired: updatedEvent.end_date < today,
      days_remaining: updatedEvent.end_date >= today
        ? Math.ceil((new Date(updatedEvent.end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    }

    return NextResponse.json({ success: true, event: enriched })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}