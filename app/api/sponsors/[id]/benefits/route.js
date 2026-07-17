import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyCaller(request, mandalIdToCheck) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 }
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid session', status: 401 }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role, mandal_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Forbidden: Requester profile not found', status: 403 }
  }

  if (!['admin', 'manager'].includes(profile.role)) {
    return { error: 'Forbidden: Only Adhyaksha or Khajindar can manage sponsorships', status: 403 }
  }

  if (mandalIdToCheck && profile.mandal_id !== mandalIdToCheck) {
    return { error: 'Forbidden: You do not belong to this mandal', status: 403 }
  }

  return { caller: profile, callerId: user.id }
}

// POST — add a promised benefit/deliverable for a sponsor
export async function POST(request, { params }) {
  try {
    const { id: sponsor_id } = await params
    const body = await request.json()
    const { benefit_name, repetition, date_start, date_end, duration_text } = body

    if (!benefit_name || !benefit_name.trim()) {
      return NextResponse.json({ error: 'benefit_name is required' }, { status: 400 })
    }

    if (date_start && date_end && new Date(date_end) < new Date(date_start)) {
      return NextResponse.json({ error: 'date_end cannot be before date_start' }, { status: 400 })
    }

    const { data: sponsor, error: sponsorError } = await supabaseAdmin
      .from('sponsors')
      .select('id, mandal_id')
      .eq('id', sponsor_id)
      .single()

    if (sponsorError || !sponsor) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, sponsor.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { data: benefit, error: insertError } = await supabaseAdmin
      .from('sponsor_benefits')
      .insert({
        sponsor_id,
        benefit_name: benefit_name.trim(),
        repetition: repetition?.trim() || null,
        date_start: date_start || null,
        date_end: date_end || null,
        duration_text: duration_text?.trim() || null
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not add benefit' }, { status: 500 })
    }

    return NextResponse.json({ success: true, benefit })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}