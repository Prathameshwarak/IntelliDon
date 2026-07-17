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

const SPONSOR_TYPES = ['finance', 'product_service', 'media', 'venue', 'food', 'other']
const PACKAGES = ['title', 'platinum', 'gold', 'silver', 'supporting']
const CONTRIBUTION_TYPES = ['cash', 'goods', 'service']

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

    const {
      company_name, reference_name, contact_person_name, contact_person_phone, email, address, gst_no,
      sponsor_type, package: pkg,
      committed_amount, contribution_type, contribution_date, contribution_duration,
      payment_method, transaction_id, estimated_value, quantity, goods_service_description,
      notes
    } = body

    if (!company_name || !company_name.trim()) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }
    if (sponsor_type && !SPONSOR_TYPES.includes(sponsor_type)) {
      return NextResponse.json({ error: 'Invalid sponsor type' }, { status: 400 })
    }
    if (pkg && !PACKAGES.includes(pkg)) {
      return NextResponse.json({ error: 'Invalid sponsor package' }, { status: 400 })
    }
    if (contribution_type && !CONTRIBUTION_TYPES.includes(contribution_type)) {
      return NextResponse.json({ error: 'Invalid contribution type' }, { status: 400 })
    }
    if (committed_amount !== undefined && committed_amount !== null && (isNaN(committed_amount) || Number(committed_amount) < 0)) {
      return NextResponse.json({ error: 'Committed amount must be zero or a positive number' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    // If lowering committed_amount below what's already been received, block it —
    // otherwise amount_pending would go negative and confuse the installment UI.
    if (committed_amount !== undefined && committed_amount !== null) {
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
        company_name: company_name.trim(),
        reference_name: reference_name?.trim() || null,
        contact_person_name: contact_person_name?.trim() || null,
        contact_person_phone: contact_person_phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        gst_no: gst_no?.trim() || null,
        sponsor_type: sponsor_type || null,
        package: pkg || null,
        committed_amount: committed_amount !== undefined && committed_amount !== null ? Number(committed_amount) : 0,
        contribution_type: contribution_type || 'cash',
        contribution_date: contribution_date || null,
        contribution_duration: contribution_duration?.trim() || null,
        payment_method: payment_method?.trim() || null,
        transaction_id: transaction_id?.trim() || null,
        estimated_value: estimated_value ? Number(estimated_value) : null,
        quantity: quantity ? Number(quantity) : null,
        goods_service_description: goods_service_description?.trim() || null,
        notes: notes?.trim() || null,
        updated_by: authCheck.callerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Could not update sponsor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sponsor: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — remove a sponsor (payments + benefits cascade)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params

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

    const { error: deleteError } = await supabaseAdmin.from('sponsors').delete().eq('id', id)
    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete sponsor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}