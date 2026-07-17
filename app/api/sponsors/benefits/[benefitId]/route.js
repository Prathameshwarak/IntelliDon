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

async function loadBenefitWithSponsor(benefitId) {
  const { data: benefit, error } = await supabaseAdmin
    .from('sponsor_benefits')
    .select('*, sponsors!inner(id, mandal_id)')
    .eq('id', benefitId)
    .single()
  if (error || !benefit) return null
  return benefit
}

// PATCH — edit a benefit, or just toggle delivered: true/false
export async function PATCH(request, { params }) {
  try {
    const { benefitId } = await params
    const body = await request.json()
    const { benefit_name, delivered, repetition, date_start, date_end, duration_text } = body

    const benefit = await loadBenefitWithSponsor(benefitId)
    if (!benefit) return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })

    const authCheck = await verifyCaller(request, benefit.sponsors.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    if (date_start !== undefined && date_end !== undefined && date_start && date_end && new Date(date_end) < new Date(date_start)) {
      return NextResponse.json({ error: 'date_end cannot be before date_start' }, { status: 400 })
    }

    const updates = { updated_at: new Date().toISOString() }
    if (benefit_name !== undefined) {
      if (!benefit_name.trim()) return NextResponse.json({ error: 'benefit_name cannot be empty' }, { status: 400 })
      updates.benefit_name = benefit_name.trim()
    }
    if (delivered !== undefined) updates.delivered = !!delivered
    if (repetition !== undefined) updates.repetition = repetition?.trim() || null
    if (date_start !== undefined) updates.date_start = date_start || null
    if (date_end !== undefined) updates.date_end = date_end || null
    if (duration_text !== undefined) updates.duration_text = duration_text?.trim() || null

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('sponsor_benefits')
      .update(updates)
      .eq('id', benefitId)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Could not update benefit' }, { status: 500 })
    }

    return NextResponse.json({ success: true, benefit: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — remove a promised benefit
export async function DELETE(request, { params }) {
  try {
    const { benefitId } = await params

    const benefit = await loadBenefitWithSponsor(benefitId)
    if (!benefit) return NextResponse.json({ error: 'Benefit not found' }, { status: 404 })

    const authCheck = await verifyCaller(request, benefit.sponsors.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { error: deleteError } = await supabaseAdmin.from('sponsor_benefits').delete().eq('id', benefitId)
    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete benefit' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}