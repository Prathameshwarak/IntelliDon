import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
)

// Helper to get authorization headers
async function getAuthUser(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mandal_id = searchParams.get('mandal_id')
    const collector_id = searchParams.get('collector_id')

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    // Authenticate
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role access
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.mandal_id !== mandal_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('collector_settlements')
      .select(`
        *,
        users!collector_id (
          full_name
        ),
        verified_user:users!verified_by (
          full_name
        ),
        events (
          name,
          year
        )
      `)
      .eq('mandal_id', mandal_id)
      .order('created_at', { ascending: false })

    if (collector_id) {
      query = query.eq('collector_id', collector_id)
    }

    const { data: settlements, error } = await query
    if (error) {
      console.error('Fetch settlements error:', error)
      return NextResponse.json({ error: 'Could not fetch settlements' }, { status: 500 })
    }

    return NextResponse.json({ success: true, settlements })
  } catch (err) {
    console.error('Unexpected error in GET settlements:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { collector_id, event_id, verified_by, notes, payment_mode } = body

    if (!collector_id || !event_id || !verified_by) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Authenticate
    const authUser = await getAuthUser(request)
    if (!authUser || authUser.id !== verified_by) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify verifier exists and has authority (admin/manager)
    const { data: verifier } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', verified_by)
      .single()

    if (!verifier || !['admin', 'manager'].includes(verifier.role)) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized action' }, { status: 403 })
    }

    // Verify collector exists and belongs to same mandal
    const { data: collector } = await supabaseAdmin
      .from('users')
      .select('mandal_id')
      .eq('id', collector_id)
      .single()

    if (!collector || collector.mandal_id !== verifier.mandal_id) {
      return NextResponse.json({ error: 'Invalid collector or mandal mismatch' }, { status: 400 })
    }

    // Query pending unsettled donations for this collector
    let query = supabaseAdmin
      .from('donations')
      .select('id, amount, payment_mode')
      .eq('collected_by', collector_id)
      .eq('event_id', event_id)
      .eq('status', 'verified')
      .is('settlement_id', null)

    if (payment_mode === 'cash') {
      query = query.eq('payment_mode', 'cash')
    } else if (payment_mode === 'upi') {
      query = query.eq('payment_mode', 'upi_collector')
    }

    const { data: pendingDonations, error: fetchErr } = await query

    if (fetchErr) {
      console.error('Fetch pending donations for settlement error:', fetchErr)
      return NextResponse.json({ error: 'Could not fetch donations' }, { status: 500 })
    }

    if (!pendingDonations || pendingDonations.length === 0) {
      return NextResponse.json({ error: 'No verified donations awaiting settlement' }, { status: 400 })
    }

    // Calculate amounts
    let cash_amount = 0
    let online_amount = 0
    pendingDonations.forEach(d => {
      const amt = Number(d.amount)
      if (d.payment_mode === 'cash') {
        cash_amount += amt
      } else {
        online_amount += amt
      }
    })

    const total_amount = cash_amount + online_amount
    const total_donations = pendingDonations.length
    const verified_at = new Date().toISOString()

    // Insert collector_settlements row
    const { data: settlement, error: insertErr } = await supabaseAdmin
      .from('collector_settlements')
      .insert({
        collector_id,
        mandal_id: verifier.mandal_id,
        event_id,
        cash_amount,
        online_amount,
        total_amount,
        total_donations,
        status: 'settled',
        verified_by,
        verified_at,
        notes: notes || null
      })
      .select()
      .single()

    if (insertErr || !settlement) {
      console.error('Insert settlement error:', insertErr)
      return NextResponse.json({ error: 'Could not record settlement' }, { status: 500 })
    }

    // Update donations with settlement_id
    const donationIds = pendingDonations.map(d => d.id)
    const { error: updateErr } = await supabaseAdmin
      .from('donations')
      .update({ settlement_id: settlement.id })
      .in('id', donationIds)

    if (updateErr) {
      console.error('Update donations with settlement_id error:', updateErr)
      // Rollback settlement row manually
      await supabaseAdmin.from('collector_settlements').delete().eq('id', settlement.id)
      return NextResponse.json({ error: 'Failed to assign settlement to donations' }, { status: 500 })
    }

    return NextResponse.json({ success: true, settlement })
  } catch (err) {
    console.error('Unexpected error in POST settlement:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
