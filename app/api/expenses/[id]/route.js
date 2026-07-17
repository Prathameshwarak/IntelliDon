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
    return { error: 'Forbidden: Only Adhyaksha or Khajindar can manage expenses', status: 403 }
  }

  if (mandalIdToCheck && profile.mandal_id !== mandalIdToCheck) {
    return { error: 'Forbidden: You do not belong to this mandal', status: 403 }
  }

  return { caller: profile, callerId: user.id }
}

// PATCH — edit an expense's core details
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { expense_name, vendor_name, amount, expense_date, notes } = body

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('event_expenses')
      .select('id, mandal_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, existing.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    if (!expense_name || !amount || !expense_date) {
      return NextResponse.json({ error: 'expense_name, amount and expense_date are required' }, { status: 400 })
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('event_expenses')
      .update({
        expense_name: expense_name.trim(),
        vendor_name: vendor_name?.trim() || null,
        amount: Number(amount),
        expense_date,
        notes: notes?.trim() || null,
        updated_by: authCheck.callerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Could not update expense' }, { status: 500 })
    }

    const { data: payments } = await supabaseAdmin
      .from('expense_payments')
      .select('*')
      .eq('expense_id', id)

    const amountPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const amountPending = Math.max(0, Number(updated.amount) - amountPaid)
    const paymentStatus = amountPaid === 0 ? 'pending' : amountPending > 0 ? 'partially_paid' : 'completed'

    return NextResponse.json({
      success: true,
      expense: { ...updated, amount_paid: amountPaid, amount_pending: amountPending, payment_status: paymentStatus, payments: payments || [] }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — remove an expense (and its payments, via ON DELETE CASCADE)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('event_expenses')
      .select('id, mandal_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, existing.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { error: deleteError } = await supabaseAdmin.from('event_expenses').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete expense' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}