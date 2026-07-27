import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET — fetch the collector's mandal + active events
// The collector screen needs mandal_id and event_id to submit a donation
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Authenticate Bearer token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }
    // Get the collector's user row to find their mandal
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, mandal_id')
      .eq('id', user_id)
      .single()

    if (userError || !userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!['collector', 'admin', 'manager'].includes(userRow.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check authorization: must be the user itself or admin/manager of the same mandal
    if (authUser.id !== user_id) {
      const { data: callerProfile } = await supabaseAdmin
        .from('users')
        .select('role, mandal_id')
        .eq('id', authUser.id)
        .single()

      if (!callerProfile || !['admin', 'manager'].includes(callerProfile.role) || callerProfile.mandal_id !== userRow.mandal_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get the mandal details
    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .select('id, name, city, address, phone, status')
      .eq('id', userRow.mandal_id)
      .single()

    if (mandalError || !mandal) {
      return NextResponse.json({ error: 'Mandal not found' }, { status: 404 })
    }

    // Get active events for this mandal valid for today
    const today = new Date().toISOString().split('T')[0]
    let { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, name, year, upi_id, upi_qr_url, start_date, end_date, is_suspended, is_active')
      .eq('mandal_id', userRow.mandal_id)
      .eq('is_active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('year', { ascending: false })

    // Filter out any suspended events
    events = (events || []).filter(e => !e.is_suspended)

    return NextResponse.json({
      user: {
        id: userRow.id,
        full_name: userRow.full_name,
        role: userRow.role
      },
      mandal,
      events
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}