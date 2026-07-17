import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Admin (Adhyaksha) and Manager (Khajindar) can manage expenses (#11).
// Collectors (Sevak) have no access to this endpoint.
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

// Derive amount_paid / amount_pending / payment_status from payment rows.
function withComputedTotals(expense, payments) {
  const amountPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const amountPending = Math.max(0, Number(expense.amount) - amountPaid)
  let paymentStatus = 'pending'
  if (amountPaid > 0 && amountPending > 0) paymentStatus = 'partially_paid'
  else if (amountPaid > 0 && amountPending <= 0) paymentStatus = 'completed'

  return {
    ...expense,
    amount_paid: amountPaid,
    amount_pending: amountPending,
    payment_status: paymentStatus,
    payments: payments.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  }
}

// GET — list all expenses (+ their payments) for one event
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get('event_id')
  const mandal_id = searchParams.get('mandal_id')

  if (!event_id || !mandal_id) {
    return NextResponse.json({ error: 'event_id and mandal_id are required' }, { status: 400 })
  }

  const authCheck = await verifyCaller(request, mandal_id)
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const { data: expenses, error: expenseError } = await supabaseAdmin
    .from('event_expenses')
    .select('*')
    .eq('event_id', event_id)
    .eq('mandal_id', mandal_id)
    .order('expense_date', { ascending: false })

  if (expenseError) {
    return NextResponse.json({ error: 'Could not fetch expenses' }, { status: 500 })
  }

  if (expenses.length === 0) {
    return NextResponse.json({ expenses: [], summary: { total_amount: 0, total_paid: 0, total_pending: 0 } })
  }

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from('expense_payments')
    .select('*')
    .in('expense_id', expenses.map(e => e.id))

  if (paymentsError) {
    return NextResponse.json({ error: 'Could not fetch payments' }, { status: 500 })
  }

  const paymentsByExpense = {}
  for (const p of payments) {
    if (!paymentsByExpense[p.expense_id]) paymentsByExpense[p.expense_id] = []
    paymentsByExpense[p.expense_id].push(p)
  }

  const fullExpenses = expenses.map(e => withComputedTotals(e, paymentsByExpense[e.id] || []))

  const summary = fullExpenses.reduce((acc, e) => ({
    total_amount: acc.total_amount + Number(e.amount),
    total_paid: acc.total_paid + e.amount_paid,
    total_pending: acc.total_pending + e.amount_pending
  }), { total_amount: 0, total_paid: 0, total_pending: 0 })

  return NextResponse.json({ expenses: fullExpenses, summary })
}

// POST — create a new expense line item for an event
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, event_id, expense_name, vendor_name, amount, expense_date, notes } = body

    if (!mandal_id || !event_id || !expense_name || !amount || !expense_date) {
      return NextResponse.json({ error: 'expense_name, amount and expense_date are required' }, { status: 400 })
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (isNaN(new Date(expense_date).getTime())) {
      return NextResponse.json({ error: 'Expense date is invalid' }, { status: 400 })
    }

    const authCheck = await verifyCaller(request, mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Confirm the event actually belongs to this mandal
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', event_id)
      .eq('mandal_id', mandal_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { data: expense, error: insertError } = await supabaseAdmin
      .from('event_expenses')
      .insert({
        mandal_id,
        event_id,
        expense_name: expense_name.trim(),
        vendor_name: vendor_name?.trim() || null,
        amount: Number(amount),
        expense_date,
        notes: notes?.trim() || null,
        created_by: authCheck.callerId,
        updated_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not create expense' }, { status: 500 })
    }

    return NextResponse.json({ success: true, expense: withComputedTotals(expense, []) })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}