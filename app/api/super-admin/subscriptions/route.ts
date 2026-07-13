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
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  if (profileError || !profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden: Super admin access only', status: 403 }
  }
  return { callerId: user.id, callerName: profile.full_name || 'Super Admin' }
}

// GET — every mandal with its subscription row, for the super-admin panel
export async function GET(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const { data: mandals, error } = await supabaseAdmin
    .from('mandals')
    .select(`
      id, name, slug, city, status,
      subscriptions ( id, plan, status, ends_at, notes, payment_notes, last_payment_at, last_payment_amount, updated_at )
    `)
    .order('name')

  if (error) {
    console.error('Fetch subscriptions error:', error)
    return NextResponse.json({ error: 'Could not fetch subscriptions' }, { status: 500 })
  }

  return NextResponse.json({ mandals })
}

// PATCH — full control: set plan, end date, status, record a payment, add notes
// Body: { mandal_id, plan?, ends_at?, status?, mark_paid?: { amount }, notes? }
export async function PATCH(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { mandal_id, plan, ends_at, status, mark_paid, notes } = body

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }
    if (plan) {
      const { data: dbPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('id', plan)
        .maybeSingle()

      if (!dbPlan && !['trial', 'basic', 'standard'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      }
    }
    if (status && !['active', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: Record<string, any> = {
      updated_by: authCheck.callerId,
      updated_at: new Date().toISOString(),
    }
    if (plan) updates.plan = plan
    if (ends_at) {
      const minDate = new Date()
      minDate.setDate(minDate.getDate() + 30)
      minDate.setHours(0, 0, 0, 0)

      const selectedDate = new Date(ends_at)
      if (selectedDate < minDate) {
        return NextResponse.json({ error: 'Allotment duration must be at least 30 days (1 month)' }, { status: 400 })
      }
      updates.ends_at = ends_at
    }
    if (status) updates.status = status
    if (typeof notes === 'string') updates.notes = notes
    if (mark_paid) {
      updates.last_payment_at = new Date().toISOString()
      updates.last_payment_amount = mark_paid.amount ?? null
      updates.status = 'active'
    }

    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan, ends_at, status, payment_notes')
      .eq('mandal_id', mandal_id)
      .maybeSingle()

    // Build the audit log history list
    let logs: any[] = []
    if (existing && existing.payment_notes) {
      try {
        const parsed = JSON.parse(existing.payment_notes)
        if (Array.isArray(parsed)) {
          logs = parsed
        }
      } catch (e) {
        console.error('Error parsing payment_notes log history:', e)
      }
    }

    const newLog = {
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      plan: plan || (existing ? existing.plan : 'trial'),
      ends_at: ends_at || (existing ? existing.ends_at : null),
      status: status || (existing ? existing.status : 'active'),
      amount_paid: mark_paid ? (mark_paid.amount ?? null) : null,
      notes: notes || null,
      created_at: new Date().toISOString(),
      created_by: authCheck.callerName || 'Super Admin'
    }

    logs.push(newLog)
    updates.payment_notes = JSON.stringify(logs)

    const result = existing
      ? await supabaseAdmin.from('subscriptions').update(updates).eq('mandal_id', mandal_id).select().single()
      : await supabaseAdmin.from('subscriptions').insert({
          mandal_id, plan: plan || 'trial', status: status || 'active', ends_at: ends_at || null, ...updates
        }).select().single()

    if (result.error) {
      console.error('Update subscription error:', result.error)
      return NextResponse.json({ error: 'Could not update subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true, subscription: result.data })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}