import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EXPENSE_PAYMENT_MODE_VALUES } from '@/lib/expensePaymentModes'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Admin (Adhyaksha) and Manager (Khajindar) can manage expenses.
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

// ── Field validation (mirrors the DB-level CHECK constraints — this
//    is the primary line of defense; the DB constraints are the backstop) ──
const MAX_AMOUNT = 999999999 // 9 digits

function validateExpenseFields({ expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id, payment_mode }) {
  if (!expense_date || isNaN(new Date(expense_date).getTime())) {
    return 'A valid expense date is required'
  }
  if (!vendor_name || !vendor_name.trim()) {
    return 'Vendor name is required'
  }
  if (vendor_name.trim().length > 50) {
    return 'Vendor name must be 50 characters or fewer'
  }
  if (vendor_phone && !/^[0-9]{10}$/.test(vendor_phone.trim())) {
    return 'Vendor phone must be exactly 10 digits'
  }
  if (!title || !title.trim()) {
    return 'Title is required'
  }
  if (title.trim().length > 75) {
    return 'Title must be 75 characters or fewer'
  }
  if (description && description.trim().length > 500) {
    return 'Description must be 500 characters or fewer'
  }
  if (amount === undefined || amount === null || amount === '' || isNaN(amount) || Number(amount) <= 0) {
    return 'Amount must be a positive number'
  }
  if (Number(amount) > MAX_AMOUNT) {
    return 'Amount cannot exceed 9 digits'
  }
  if (transaction_id && transaction_id.trim()) {
    if (transaction_id.trim().length > 25) return 'Transaction ID must be 25 characters or fewer'
    if (!/^[A-Za-z0-9]+$/.test(transaction_id.trim())) return 'Transaction ID must be alphanumeric'
  }
  if (payment_mode && !EXPENSE_PAYMENT_MODE_VALUES.includes(payment_mode)) {
    return 'Invalid payment mode'
  }
  return null
}

// GET — list expenses for an event, optionally filtered by date range
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get('event_id')
  const mandal_id = searchParams.get('mandal_id')
  const from_date = searchParams.get('from_date') // inclusive, YYYY-MM-DD
  const to_date = searchParams.get('to_date')     // inclusive, YYYY-MM-DD

  if (!event_id || !mandal_id) {
    return NextResponse.json({ error: 'event_id and mandal_id are required' }, { status: 400 })
  }

  const authCheck = await verifyCaller(request, mandal_id)
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  let query = supabaseAdmin
    .from('event_expenses')
    .select('*')
    .eq('event_id', event_id)
    .eq('mandal_id', mandal_id)

  if (from_date && !isNaN(new Date(from_date).getTime())) query = query.gte('expense_date', from_date)
  if (to_date && !isNaN(new Date(to_date).getTime())) query = query.lte('expense_date', to_date)

  const { data: expenses, error: expenseError } = await query.order('expense_date', { ascending: false })

  if (expenseError) {
    return NextResponse.json({ error: 'Could not fetch expenses' }, { status: 500 })
  }

  if (expenses.length === 0) {
    return NextResponse.json({ expenses: [], summary: { total_amount: 0, count: 0 } })
  }

  // Resolve created_by / updated_by ids to display names in one batch query
  const userIds = [...new Set(expenses.flatMap(e => [e.created_by, e.updated_by]).filter(Boolean))]
  let namesById = {}
  if (userIds.length > 0) {
    const { data: creators } = await supabaseAdmin.from('users').select('id, full_name').in('id', userIds)
    namesById = Object.fromEntries((creators || []).map(u => [u.id, u.full_name]))
  }

  // Each flat expense entry has (at most) a single matching expense_payments
  // row — created alongside it to capture "how it was paid" (payment mode).
  // Resolve those in one batch query and attach to each expense.
  const expenseIds = expenses.map(e => e.id)
  const { data: payments } = await supabaseAdmin
    .from('expense_payments')
    .select('id, expense_id, payment_mode')
    .in('expense_id', expenseIds)

  const paymentByExpenseId = {}
  for (const p of payments || []) {
    // If multiple payment rows ever exist for one expense, prefer the most
    // recently seen one (query has no explicit order, but this keeps the
    // lookup defensive rather than throwing away data).
    paymentByExpenseId[p.expense_id] = p
  }

  const fullExpenses = expenses.map(e => ({
    ...e,
    created_by_name: e.created_by ? (namesById[e.created_by] || 'Unknown') : null,
    updated_by_name: e.updated_by ? (namesById[e.updated_by] || 'Unknown') : null,
    payment_mode: paymentByExpenseId[e.id]?.payment_mode || null,
    payment_id: paymentByExpenseId[e.id]?.id || null
  }))

  const summary = {
    total_amount: fullExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    count: fullExpenses.length
  }

  return NextResponse.json({ expenses: fullExpenses, summary })
}

// POST — create a new (flat) expense
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, event_id, expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id, payment_mode } = body

    if (!mandal_id || !event_id) {
      return NextResponse.json({ error: 'mandal_id and event_id are required' }, { status: 400 })
    }

    const validationError = validateExpenseFields({ expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id, payment_mode })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const authCheck = await verifyCaller(request, mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Confirm the event actually belongs to this mandal (prevents IDOR
    // via a crafted event_id from another organization)
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
        expense_date,
        vendor_name: vendor_name.trim(),
        vendor_phone: vendor_phone?.trim() || null,
        title: title.trim(),
        description: description?.trim() || null,
        amount: Number(amount),
        transaction_id: transaction_id?.trim() || null,
        created_by: authCheck.callerId,
        updated_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not create expense' }, { status: 500 })
    }

    // Record how this expense was paid as a single, fully-paid entry in the
    // existing expense_payments table (amount === expense.amount). This
    // reuses the installment-payment infrastructure already backing
    // /api/expenses/[id]/payments instead of adding a new column.
    let paymentId = null
    if (payment_mode) {
      const { data: payment } = await supabaseAdmin
        .from('expense_payments')
        .insert({
          expense_id: expense.id,
          amount: Number(amount),
          paid_at: new Date(expense_date).toISOString(),
          payment_mode,
          recorded_by: authCheck.callerId
        })
        .select('id')
        .single()
      paymentId = payment?.id || null
    }

    return NextResponse.json({ success: true, expense: { ...expense, payment_mode: payment_mode || null, payment_id: paymentId } })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
