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

const VALID_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'other']

// POST — record a new installment/payment against an expense
export async function POST(request, { params }) {
  try {
    const { id: expense_id } = await params
    const body = await request.json()
    const { amount, paid_at, payment_mode, notes } = body

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }
    if (payment_mode && !VALID_MODES.includes(payment_mode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 })
    }

    const { data: expense, error: expenseError } = await supabaseAdmin
      .from('event_expenses')
      .select('id, mandal_id, amount')
      .eq('id', expense_id)
      .single()

    if (expenseError || !expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, expense.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Don't allow paying more than what's actually owed
    const { data: existingPayments } = await supabaseAdmin
      .from('expense_payments')
      .select('amount')
      .eq('expense_id', expense_id)

    const alreadyPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const remaining = Number(expense.amount) - alreadyPaid

    if (Number(amount) > remaining + 0.01) {
      return NextResponse.json(
        { error: `This payment (₹${amount}) exceeds the remaining balance (₹${remaining.toFixed(2)})` },
        { status: 400 }
      )
    }

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('expense_payments')
      .insert({
        expense_id,
        amount: Number(amount),
        paid_at: paid_at || new Date().toISOString(),
        payment_mode: payment_mode || null,
        notes: notes?.trim() || null,
        recorded_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not record payment' }, { status: 500 })
    }

    const newAmountPaid = alreadyPaid + Number(amount)
    const newAmountPending = Math.max(0, Number(expense.amount) - newAmountPaid)
    const paymentStatus = newAmountPending <= 0 ? 'completed' : 'partially_paid'

    return NextResponse.json({
      success: true,
      payment,
      totals: { amount_paid: newAmountPaid, amount_pending: newAmountPending, payment_status: paymentStatus }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}