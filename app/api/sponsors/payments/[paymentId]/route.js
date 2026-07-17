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

async function loadPaymentWithSponsor(paymentId) {
  const { data: payment, error } = await supabaseAdmin
    .from('sponsor_payments')
    .select('*, sponsors!inner(id, mandal_id, committed_amount)')
    .eq('id', paymentId)
    .single()
  if (error || !payment) return null
  return payment
}

// PATCH — correct a sponsor payment entry
export async function PATCH(request, { params }) {
  try {
    const { paymentId } = await params
    const body = await request.json()
    const { amount, received_at, payment_method, transaction_id, notes } = body

    const payment = await loadPaymentWithSponsor(paymentId)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const sponsor = payment.sponsors
    const authCheck = await verifyCaller(request, sponsor.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    if (amount !== undefined && (isNaN(amount) || Number(amount) <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (amount !== undefined && Number(sponsor.committed_amount) > 0) {
      const { data: siblings } = await supabaseAdmin
        .from('sponsor_payments')
        .select('amount')
        .eq('sponsor_id', sponsor.id)
        .neq('id', paymentId)

      const othersTotal = (siblings || []).reduce((sum, p) => sum + Number(p.amount), 0)
      if (othersTotal + Number(amount) > Number(sponsor.committed_amount) + 0.01) {
        return NextResponse.json({ error: 'This amount would exceed the committed amount' }, { status: 400 })
      }
    }

    const updates = {}
    if (amount !== undefined) updates.amount = Number(amount)
    if (received_at !== undefined) updates.received_at = received_at
    if (payment_method !== undefined) updates.payment_method = payment_method?.trim() || null
    if (transaction_id !== undefined) updates.transaction_id = transaction_id?.trim() || null
    if (notes !== undefined) updates.notes = notes?.trim() || null

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('sponsor_payments')
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

// DELETE — remove a sponsor payment entry
export async function DELETE(request, { params }) {
  try {
    const { paymentId } = await params

    const payment = await loadPaymentWithSponsor(paymentId)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const authCheck = await verifyCaller(request, payment.sponsors.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { error: deleteError } = await supabaseAdmin.from('sponsor_payments').delete().eq('id', paymentId)
    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}