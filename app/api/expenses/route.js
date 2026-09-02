import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { EXPENSE_PAYMENT_MODE_VALUES, EXPENSE_AMOUNT_REGEX, roundToTwoDecimals, isExpenseActionWindowClosed, EXPENSE_ACTION_GRACE_DAYS } from '@/lib/expensePaymentModes'
import { getCachedAuthUserAndProfile, isAuthError } from '@/lib/auth-cache'
import { getOrSetCache, invalidateCacheByPrefix } from '@/lib/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Admin (Adhyaksha) and Manager (Khajindar) can manage expenses.
async function verifyCaller(request, mandalIdToCheck) {
  const authResult = await getCachedAuthUserAndProfile(request, supabaseAdmin)
  if (isAuthError(authResult)) {
    return { error: authResult.error, status: authResult.status }
  }

  const profile = authResult.profile
  if (!profile) {
    return { error: 'Forbidden: Requester profile not found', status: 403 }
  }

  if (!['admin', 'manager'].includes(profile.role)) {
    return { error: 'Forbidden: Only Adhyaksha or Khajindar can manage expenses', status: 403 }
  }

  if (mandalIdToCheck && profile.mandal_id !== mandalIdToCheck) {
    return { error: 'Forbidden: You do not belong to this mandal', status: 403 }
  }

  return { caller: profile, callerId: authResult.user.id }
}

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
  if (!EXPENSE_AMOUNT_REGEX.test(String(amount).trim())) {
    return 'Amount can have at most 2 decimal places'
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

  const cacheKey = `expenses:${mandal_id}:${event_id}:${from_date || ''}:${to_date || ''}`
  const result = await getOrSetCache(cacheKey, async () => {
    let query = supabaseAdmin
      .from('event_expenses')
      .select('*')
      .eq('event_id', event_id)
      .eq('mandal_id', mandal_id)

    if (from_date && !isNaN(new Date(from_date).getTime())) query = query.gte('expense_date', from_date)
    if (to_date && !isNaN(new Date(to_date).getTime())) query = query.lte('expense_date', to_date)

    const { data: expenses, error: expenseError } = await query.order('expense_date', { ascending: false })

    if (expenseError) {
      throw new Error('Could not fetch expenses')
    }

    if (expenses.length === 0) {
      return { expenses: [], summary: { total_amount: 0, total_paid: 0, count: 0 } }
    }

    const userIds = [...new Set(expenses.flatMap(e => [e.created_by, e.updated_by]).filter(Boolean))]
    let namesById = {}
    if (userIds.length > 0) {
      const { data: creators } = await supabaseAdmin.from('users').select('id, full_name').in('id', userIds)
      namesById = Object.fromEntries((creators || []).map(u => [u.id, u.full_name]))
    }

    const expenseIds = expenses.map(e => e.id)
    const { data: payments } = await supabaseAdmin
      .from('expense_payments')
      .select('*')
      .in('expense_id', expenseIds)

    const paymentsByExpenseId = {}
    for (const p of payments || []) {
      if (!paymentsByExpenseId[p.expense_id]) paymentsByExpenseId[p.expense_id] = []
      paymentsByExpenseId[p.expense_id].push(p)
    }

    const fullExpenses = expenses.map(e => {
      const expensePayments = (paymentsByExpenseId[e.id] || []).sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      const amountPaid = roundToTwoDecimals(expensePayments.reduce((sum, p) => sum + Number(p.amount), 0))
      const amountPending = roundToTwoDecimals(Math.max(0, Number(e.amount) - amountPaid))
      const paymentStatus = amountPaid <= 0 ? 'pending' : amountPending > 0 ? 'partially_paid' : 'completed'
      return {
        ...e,
        created_by_name: e.created_by ? (namesById[e.created_by] || 'Unknown') : null,
        updated_by_name: e.updated_by ? (namesById[e.updated_by] || 'Unknown') : null,
        amount_paid: amountPaid,
        amount_pending: amountPending,
        payment_status: paymentStatus,
        payments: expensePayments
      }
    })

    const summary = {
      total_amount: roundToTwoDecimals(fullExpenses.reduce((sum, e) => sum + Number(e.amount), 0)),
      total_paid: roundToTwoDecimals(fullExpenses.reduce((sum, e) => sum + e.amount_paid, 0)),
      count: fullExpenses.length
    }

    return { expenses: fullExpenses, summary }
  }, 20)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=20' }
  })
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

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, end_date')
      .eq('id', event_id)
      .eq('mandal_id', mandal_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (isExpenseActionWindowClosed(event.end_date)) {
      return NextResponse.json({ error: `The ${EXPENSE_ACTION_GRACE_DAYS}-day window to add expenses for this event has closed (event ended on ${event.end_date}). You can still view, search, filter, and download existing records.` }, { status: 403 })
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
        amount: roundToTwoDecimals(amount),
        transaction_id: transaction_id?.trim() || null,
        created_by: authCheck.callerId,
        updated_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not create expense' }, { status: 500 })
    }

    invalidateCacheByPrefix(`expenses:${mandal_id}`)

    return NextResponse.json({
      success: true,
      expense: { ...expense, amount_paid: 0, amount_pending: Number(expense.amount), payment_status: 'pending', payments: [] }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
