import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { validateSponsorPayload, buildSponsorColumns } from '@/lib/sponsorValidation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Sponsorship management is available to the same roles as the
// Donations tab it lives inside: Adhyaksha (admin) and Khajindar (manager).
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


function withComputed(sponsor, payments, benefits) {
  const amountReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const amountPending = Math.max(0, Number(sponsor.committed_amount) - amountReceived)
  let status = 'pending'
  if (amountReceived > 0 && amountPending > 0) status = 'partially_paid'
  else if (amountReceived > 0 && amountPending <= 0) status = 'completed'
  else if (Number(sponsor.committed_amount) === 0) status = 'n/a'

  return {
    ...sponsor,
    amount_received: amountReceived,
    amount_pending: amountPending,
    payment_status: status,
    payments: payments.sort((a, b) => new Date(b.received_at) - new Date(a.received_at)),
    benefits: benefits.sort((a, b) => (a.benefit_name > b.benefit_name ? 1 : -1))
  }
}

// GET — list sponsors for a mandal (optionally filtered by event_id)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mandal_id = searchParams.get('mandal_id')
  const event_id = searchParams.get('event_id')

  if (!mandal_id) {
    return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
  }

  const authCheck = await verifyCaller(request, mandal_id)
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  let query = supabaseAdmin.from('sponsors').select('*').eq('mandal_id', mandal_id)
  if (event_id) query = query.eq('event_id', event_id)

  const { data: sponsors, error: sponsorsError } = await query.order('created_at', { ascending: false })
  if (sponsorsError) {
    return NextResponse.json({ error: 'Could not fetch sponsors' }, { status: 500 })
  }

  if (sponsors.length === 0) {
    return NextResponse.json({ sponsors: [], summary: { total_committed: 0, total_received: 0, total_pending: 0 } })
  }

  const ids = sponsors.map(s => s.id)
  const [{ data: payments, error: paymentsError }, { data: benefits, error: benefitsError }] = await Promise.all([
    supabaseAdmin.from('sponsor_payments').select('*').in('sponsor_id', ids),
    supabaseAdmin.from('sponsor_benefits').select('*').in('sponsor_id', ids)
  ])

  if (paymentsError || benefitsError) {
    return NextResponse.json({ error: 'Could not fetch sponsor details' }, { status: 500 })
  }

  const paymentsBySponsor = {}
  for (const p of payments) {
    if (!paymentsBySponsor[p.sponsor_id]) paymentsBySponsor[p.sponsor_id] = []
    paymentsBySponsor[p.sponsor_id].push(p)
  }
  const benefitsBySponsor = {}
  for (const b of benefits) {
    if (!benefitsBySponsor[b.sponsor_id]) benefitsBySponsor[b.sponsor_id] = []
    benefitsBySponsor[b.sponsor_id].push(b)
  }

  const fullSponsors = sponsors.map(s => withComputed(s, paymentsBySponsor[s.id] || [], benefitsBySponsor[s.id] || []))

  const summary = fullSponsors.reduce((acc, s) => ({
    total_committed: acc.total_committed + Number(s.committed_amount),
    total_received: acc.total_received + s.amount_received,
    total_pending: acc.total_pending + s.amount_pending
  }), { total_committed: 0, total_received: 0, total_pending: 0 })

  return NextResponse.json({ sponsors: fullSponsors, summary })
}

// POST — create a new sponsor
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, event_id, company_name } = body

    if (!mandal_id || !event_id || !company_name || !company_name.trim()) {
      return NextResponse.json({ error: 'event_id and company_name are required' }, { status: 400 })
    }

    const validationError = validateSponsorPayload(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const authCheck = await verifyCaller(request, mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', event_id)
      .eq('mandal_id', mandal_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { data: sponsor, error: insertError } = await supabaseAdmin
      .from('sponsors')
      .insert({
        mandal_id,
        event_id,
        ...buildSponsorColumns(body),
        created_by: authCheck.callerId,
        updated_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Sponsor insert error:', insertError)
      return NextResponse.json({ error: 'Could not create sponsor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sponsor: withComputed(sponsor, [], []) })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}