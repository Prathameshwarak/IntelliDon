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

const MAX_AMOUNT = 999999999 // 9 digits

function validateExpenseFields({ expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id }) {
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
  return null
}

// PATCH — edit an expense's details
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id } = body

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

    const validationError = validateExpenseFields({ expense_date, vendor_name, vendor_phone, title, description, amount, transaction_id })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('event_expenses')
      .update({
        expense_date,
        vendor_name: vendor_name.trim(),
        vendor_phone: vendor_phone?.trim() || null,
        title: title.trim(),
        description: description?.trim() || null,
        amount: Number(amount),
        transaction_id: transaction_id?.trim() || null,
        updated_by: authCheck.callerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Could not update expense' }, { status: 500 })
    }

    return NextResponse.json({ success: true, expense: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — intentionally disabled. Expenses can be edited but never
// deleted (financial audit trail requirement). Return 405 rather than
// simply omitting the export, so a direct API call gets an explicit,
// unambiguous rejection instead of Next.js's generic 404.
export async function DELETE() {
  return NextResponse.json(
    { error: 'Deleting expenses is not permitted. Edit the record instead.' },
    { status: 405 }
  )
}