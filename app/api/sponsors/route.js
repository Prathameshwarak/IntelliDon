import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

const SPONSOR_TYPES = ['finance', 'product_service', 'media', 'venue', 'food', 'other']
const PACKAGES = ['title', 'platinum', 'gold', 'silver', 'supporting']
const CONTRIBUTION_TYPES = ['cash', 'goods', 'service']

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
    const {
      mandal_id, event_id,
      company_name, reference_name, contact_person_name, contact_person_phone, email, address, gst_no,
      sponsor_type, package: pkg,
      committed_amount, contribution_type, contribution_date, contribution_duration,
      payment_method, transaction_id, estimated_value, quantity, goods_service_description,
      notes
    } = body

    if (!mandal_id || !event_id || !company_name || !company_name.trim()) {
      return NextResponse.json({ error: 'event_id and company_name are required' }, { status: 400 })
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
    if (contact_person_phone && !/^[0-9+\-\s()]{7,15}$/.test(contact_person_phone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 })
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
        company_name: company_name.trim(),
        reference_name: reference_name?.trim() || null,
        contact_person_name: contact_person_name?.trim() || null,
        contact_person_phone: contact_person_phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        gst_no: gst_no?.trim() || null,
        sponsor_type: sponsor_type || null,
        package: pkg || null,
        committed_amount: committed_amount ? Number(committed_amount) : 0,
        contribution_type: contribution_type || 'cash',
        contribution_date: contribution_date || null,
        contribution_duration: contribution_duration?.trim() || null,
        payment_method: payment_method?.trim() || null,
        transaction_id: transaction_id?.trim() || null,
        estimated_value: estimated_value ? Number(estimated_value) : null,
        quantity: quantity ? Number(quantity) : null,
        goods_service_description: goods_service_description?.trim() || null,
        notes: notes?.trim() || null,
        created_by: authCheck.callerId,
        updated_by: authCheck.callerId
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Could not create sponsor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sponsor: withComputed(sponsor, [], []) })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}