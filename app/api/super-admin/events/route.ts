import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifySuperAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 }
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid token', status: 401 }
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || !profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden: Super admin access only', status: 403 }
  }
  return { callerId: user.id }
}

export async function GET(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const { searchParams } = new URL(request.url)
  const mandalId = searchParams.get('mandal_id')

  try {
    let query = supabaseAdmin.from('events').select(`
      *,
      mandals (
        name
      )
    `)

    if (mandalId) {
      query = query.eq('mandal_id', mandalId)
    }

    const { data: events, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch super admin events error:', error)
      return NextResponse.json({ error: 'Could not fetch events' }, { status: 500 })
    }

    // Flatten mandal name for convenience
    const enrichedEvents = (events || []).map(event => {
      const mandalName = event.mandals && typeof event.mandals === 'object' && !Array.isArray(event.mandals)
        ? (event.mandals as any).name
        : '—'
      return {
        ...event,
        mandal_name: mandalName
      }
    })

    return NextResponse.json({ events: enrichedEvents })
  } catch (err) {
    console.error('Fetch super admin events unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { eventId, isSuspended } = body

    if (!eventId || isSuspended === undefined) {
      return NextResponse.json({ error: 'eventId and isSuspended are required' }, { status: 400 })
    }

    // Check if event exists and is not expired
    const { data: existingEvent, error: findError } = await supabaseAdmin
      .from('events')
      .select('end_date')
      .eq('id', eventId)
      .single()

    if (findError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0]
    if (isSuspended && existingEvent.end_date < today) {
      return NextResponse.json({ error: 'Expired events cannot be suspended' }, { status: 400 })
    }

    // Update the event's suspension status
    const { data: event, error: updateError } = await supabaseAdmin
      .from('events')
      .update({ is_suspended: isSuspended })
      .eq('id', eventId)
      .select()
      .single()

    if (updateError) {
      console.error('Suspend event error:', updateError)
      return NextResponse.json({ error: 'Could not update event status' }, { status: 500 })
    }

    // If we suspend an event, and it is currently active, we should deactivate it!
    if (isSuspended && event.is_active) {
      const { error: deactivateError } = await supabaseAdmin
        .from('events')
        .update({ is_active: false })
        .eq('id', eventId)
      if (deactivateError) {
        console.error('Deactivate suspended event error:', deactivateError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Event ${isSuspended ? 'suspended' : 'unsuspended'} successfully` 
    })
  } catch (err) {
    console.error('Suspend event unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
