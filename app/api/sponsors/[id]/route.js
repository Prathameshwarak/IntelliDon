import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { validateSponsorPayload, buildSponsorColumns } from '@/lib/sponsorValidation'

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

// PATCH — edit a sponsor's details
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('sponsors')
      .select('id, mandal_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 })
    }

    const authCheck = await verifyCaller(request, existing.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { company_name, sponsor_type, committed_amount } = body

    if (!company_name || !company_name.trim()) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    const validationError = validateSponsorPayload(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // If lowering committed_amount below what's already been received, block it —
    // otherwise amount_pending would go negative and confuse the installment UI.
    if ((sponsor_type === 'finance' || sponsor_type === 'ads_package') && committed_amount !== undefined && committed_amount !== null) {
      const { data: payments } = await supabaseAdmin.from('sponsor_payments').select('amount').eq('sponsor_id', id)
      const alreadyReceived = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
      if (Number(committed_amount) < alreadyReceived) {
        return NextResponse.json(
          { error: `Committed amount can't be less than the ₹${alreadyReceived} already received` },
          { status: 400 }
        )
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('sponsors')
      .update({
        ...buildSponsorColumns(body),
        updated_by: authCheck.callerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Sponsor update error:', updateError)
      return NextResponse.json({ error: 'Could not update sponsor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sponsor: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — intentionally disabled. Sponsors can be edited but never
// deleted, matching the removed Delete button on the Sponsor Card.
export async function DELETE() {
  return NextResponse.json(
    { error: 'Deleting sponsors is not permitted. Edit the record instead.' },
    { status: 405 }
  )
}