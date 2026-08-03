import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EXPENSE_AMOUNT_REGEX, roundToTwoDecimals, isExpenseActionWindowClosed, EXPENSE_ACTION_GRACE_DAYS } from '@/lib/expensePaymentModes'

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

// 3-hour edit window for correcting an expense payment entry — mirrors
// PAYMENT_EDIT_WINDOW_MS used for sponsor payments.
const PAYMENT_EDIT_WINDOW_MS = 3 * 60 * 60 * 1000

async function loadPaymentWithExpense(paymentId) {
  const { data: payment, error } = await supabaseAdmin
    .from('expense_payments')
    .select('*, event_expenses!inner(id, mandal_id, event_id, amount)')
    .eq('id', paymentId)
    .single()
  if (error || !payment) return null
  return payment
}

// PATCH — correct a payment entry (amount, date, mode, transaction id, notes)
export async function PATCH(request, { params }) {
  try {
    const { paymentId } = await params
    const body = await request.json()
    const { amount, paid_at, payment_mode, transaction_id, notes } = body

    const payment = await loadPaymentWithExpense(paymentId)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const expense = payment.event_expenses
    const authCheck = await verifyCaller(request, expense.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    if (Date.now() - new Date(payment.created_at).getTime() > PAYMENT_EDIT_WINDOW_MS) {
      return NextResponse.json({ error: 'This payment can no longer be edited — the 3-hour edit window has passed' }, { status: 403 })
    }

    // Payments can be edited until (Event End Date + 30 days) — after that
    // the event's expenses become view/search/filter/export-only.
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('end_date')
      .eq('id', expense.event_id)
      .single()
    if (event && isExpenseActionWindowClosed(event.end_date)) {
      return NextResponse.json({ error: `The ${EXPENSE_ACTION_GRACE_DAYS}-day window to edit payments for this event has closed (event ended on ${event.end_date}). You can still view, search, filter, and download existing records.` }, { status: 403 })
    }

    if (amount !== undefined && (isNaN(amount) || Number(amount) <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }
    if (amount !== undefined && !EXPENSE_AMOUNT_REGEX.test(String(amount).trim())) {
      return NextResponse.json({ error: 'Amount can have at most 2 decimal places' }, { status: 400 })
    }
    if (payment_mode && !VALID_MODES.includes(payment_mode)) {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 })
    }
    if (transaction_id && transaction_id.trim()) {
      if (transaction_id.trim().length > 25) return NextResponse.json({ error: 'Transaction ID must be 25 characters or fewer' }, { status: 400 })
      if (!/^[A-Za-z0-9]+$/.test(transaction_id.trim())) return NextResponse.json({ error: 'Transaction ID must be alphanumeric' }, { status: 400 })
    }

    // Re-check the total against the expense amount, excluding this payment
    if (amount !== undefined) {
      const { data: siblings } = await supabaseAdmin
        .from('expense_payments')
        .select('amount')
        .eq('expense_id', expense.id)
        .neq('id', paymentId)

      const othersTotal = roundToTwoDecimals((siblings || []).reduce((sum, p) => sum + Number(p.amount), 0))
      if (othersTotal + Number(amount) > Number(expense.amount) + 0.01) {
        return NextResponse.json({ error: 'This amount would exceed the total expense amount' }, { status: 400 })
      }
    }

    const updates = {}
    if (amount !== undefined) updates.amount = roundToTwoDecimals(amount)
    if (paid_at !== undefined) updates.paid_at = paid_at
    if (payment_mode !== undefined) updates.payment_mode = payment_mode || null
    if (transaction_id !== undefined) updates.transaction_id = transaction_id?.trim() || null
    if (notes !== undefined) updates.notes = notes?.trim() || null

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('expense_payments')
      .update(updates)
      .eq('id', paymentId)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Could not update payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true, payment: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — remove a payment entry
export async function DELETE(request, { params }) {
  try {
    const { paymentId } = await params

    const payment = await loadPaymentWithExpense(paymentId)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const authCheck = await verifyCaller(request, payment.event_expenses.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { error: deleteError } = await supabaseAdmin.from('expense_payments').delete().eq('id', paymentId)
    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}