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

// POST — record a new installment/payment received from a sponsor
export async function POST(request, { params }) {
  try {
    const { id: sponsor_id } = await params
    const body = await request.json()
    const { amount, received_at, payment_method, transaction_id, notes } = body

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const { data: sponsor, error: sponsorError } = await supabaseAdmin
      .from('sponsors')
      .select('id, mandal_id, committed_amount')
      .eq('id', sponsor_id)
      .single()

    if (sponsorError || !sponsor) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, sponsor.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Micro/in-kind sponsors may have committed_amount = 0 (e.g. pure goods/service
    // pledges tracked outside cash terms) — in that case skip the cap check.
    if (Number(sponsor.committed_amount) > 0) {
      const { data: existingPayments } = await supabaseAdmin
        .from('sponsor_payments')
        .select('amount')
        .eq('sponsor_id', sponsor_id)

      const alreadyReceived = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
      const remaining = Number(sponsor.committed_amount) - alreadyReceived

      if (Number(amount) > remaining + 0.01) {
        return NextResponse.json(
          { error: `This payment (₹${amount}) exceeds the remaining committed balance (₹${remaining.toFixed(2)})` },
          { status: 400 }
        )
      }
    }

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('sponsor_payments')
      .insert({
        sponsor_id,
        amount: Number(amount),
        received_at: received_at || new Date().toISOString(),
        payment_method: payment_method?.trim() || null,
        transaction_id: transaction_id?.trim() || null,
        notes: notes?.trim() || null,
        recorded_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not record payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true, payment })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}