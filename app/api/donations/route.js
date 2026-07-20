import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildReceiptData } from '@/lib/receiptData'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      mandal_id,
      event_id,
      donor_name,
      donor_phone,
      donor_address,
      amount,
      payment_mode,
      collected_by,
      screenshot_url
    } = body

    // Verify token if collected_by is provided
    if (collected_by) {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
      }
      const token = authHeader.split(' ')[1]
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
      }

      if (authUser.id !== collected_by) {
        const { data: verifier } = await supabaseAdmin
          .from('users')
          .select('role, mandal_id')
          .eq('id', authUser.id)
          .single()
        if (!verifier || !['admin', 'manager'].includes(verifier.role) || verifier.mandal_id !== mandal_id) {
          return NextResponse.json({ error: 'Forbidden: Cannot submit donation on behalf of this collector' }, { status: 403 })
        }
      }
    }

    // ── 1. Validate ───────────────────────────────────────────
    if (!mandal_id || !event_id || !donor_name || !amount || !payment_mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['cash', 'upi_collector', 'upi_self'].includes(payment_mode)) {
      return NextResponse.json({ error: 'Invalid payment_mode' }, { status: 400 })
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // ── 2. Check mandal is active ─────────────────────────────
    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .select('id, name, address, city, phone, status')
      .eq('id', mandal_id)
      .single()

    if (mandalError || !mandal) {
      return NextResponse.json({ error: 'Mandal not found' }, { status: 404 })
    }

    if (mandal.status !== 'active') {
      return NextResponse.json({ error: 'Mandal is not active' }, { status: 403 })
    }

    // ── 3. Check event ────────────────────────────────────────
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, year, is_active, is_suspended')
      .eq('id', event_id)
      .eq('mandal_id', mandal_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.is_suspended) {
      return NextResponse.json({ error: 'This event is suspended and cannot accept donations' }, { status: 403 })
    }

    if (!event.is_active) {
      return NextResponse.json({ error: 'This event is no longer active' }, { status: 403 })
    }

    // ── 3b. Event-access guard for collectors/managers ────────
    // Blocks a restricted team member from submitting to an event
    // outside their assigned list, even via a direct API call.
    if (collected_by) {
      const { data: collectorRow } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', collected_by)
        .single()

      if (collectorRow && collectorRow.role !== 'admin') {
        const { data: accessRows } = await supabaseAdmin
          .from('user_event_access')
          .select('event_id')
          .eq('user_id', collected_by)

        if (accessRows && accessRows.length > 0 && !accessRows.some(r => r.event_id === event_id)) {
          return NextResponse.json({ error: 'You do not have access to collect for this event' }, { status: 403 })
        }
      }
    }

    // ── 4. Duplicate phone check ──────────────────────────────
    let isDuplicate = false
    let existingDonation = null
    if (donor_phone && donor_phone.trim()) {
      const { data } = await supabaseAdmin
        .from('donations')
        .select('id, receipt_number, amount')
        .eq('event_id', event_id)
        .eq('donor_phone', donor_phone.trim())
        .maybeSingle()
      existingDonation = data
      isDuplicate = !!existingDonation
    }

    // Fetch collector full_name if collected_by is provided
    let collectorName = null
    if (collected_by) {
      const { data: collector } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', collected_by)
        .single()
      collectorName = collector?.full_name || null
    }

    const isCollectorRecorded = (payment_mode === 'cash' || payment_mode === 'upi_collector') && !!collected_by
    const { data: donation, error: donationError } = await supabaseAdmin
      .from('donations')
      .insert({
        mandal_id,
        event_id,
        donor_name: donor_name.trim(),
        donor_phone: donor_phone?.trim() || '',
        donor_address: donor_address?.trim() || null,
        amount: Number(amount),
        payment_mode,
        collected_by: collected_by || null,
        screenshot_url: screenshot_url || null,
        status: isCollectorRecorded ? 'verified' : 'pending',
        verified_by: isCollectorRecorded ? collected_by : null,
        verified_at: isCollectorRecorded ? new Date().toISOString() : null,
        verification_type: isCollectorRecorded ? 'collector' : null
      })
      .select()
      .single()

    if (donationError) {
      console.error('Donation insert error:', donationError)
      return NextResponse.json({ error: 'Could not record donation' }, { status: 500 })
    }

    let receiptData = null
    if (isCollectorRecorded && donation) {
      receiptData = buildReceiptData({
        donation,
        mandal,
        event,
        collectorName
      })
      const { error: updateError } = await supabaseAdmin
        .from('donations')
        .update({ receipt_data: receiptData })
        .eq('id', donation.id)
      if (updateError) {
        console.error('Receipt data update error:', updateError)
      }
    }

    // ── 8. Return response ────────────────────────────────────
    return NextResponse.json({
      success: true,
      donation: {
        id: donation.id,
        receipt_number: donation.receipt_number,
        donor_name: donation.donor_name,
        amount: donation.amount,
        payment_mode: donation.payment_mode,
        status: donation.status,
        created_at: donation.created_at,
        receipt_data: receiptData
      },
      duplicate_warning: isDuplicate ? {
        message: `This phone donated Rs.${existingDonation.amount} earlier in this event.`,
        previous_receipt: existingDonation.receipt_number
      } : null
    })

  } catch (err) {
    console.error('Unexpected error in donation entry:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mandal_id = searchParams.get('mandal_id')
    const event_id = searchParams.get('event_id')
    const status = searchParams.get('status')
    const collected_by = searchParams.get('collected_by')

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    // Authenticate token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', authUser.id)
      .single()

    if (!profile || profile.mandal_id !== mandal_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['admin', 'manager'].includes(profile.role)) {
      if (collected_by !== authUser.id) {
        return NextResponse.json({ error: 'Forbidden: Collectors can only view their own collections' }, { status: 403 })
      }
    }

    let query = supabaseAdmin
      .from('donations')
      .select(`
        id,
        receipt_number,
        donor_name,
        donor_phone,
        donor_address,
        amount,
        payment_mode,
        status,
        screenshot_url,
        receipt_data,
        created_at,
        collected_by,
        rejection_reason,
        verification_type,
        settlement_id,
        users!collected_by (
          full_name
        )
      `)
      .eq('mandal_id', mandal_id)
      .order('created_at', { ascending: false })

    if (event_id) query = query.eq('event_id', event_id)
    if (status) query = query.eq('status', status)
    if (collected_by) query = query.eq('collected_by', collected_by)

    let { data: donations, error } = await query

    if (error && error.message && error.message.includes('column donations.rejection_reason does not exist')) {
      // Fallback query without rejection_reason
      let fallbackQuery = supabaseAdmin
        .from('donations')
        .select(`
          id,
          receipt_number,
          donor_name,
          donor_phone,
          donor_address,
          amount,
          payment_mode,
          status,
          screenshot_url,
          receipt_data,
          created_at,
          collected_by,
          verification_type,
          settlement_id,
          users!collected_by (
            full_name
          )
        `)
        .eq('mandal_id', mandal_id)
        .order('created_at', { ascending: false })

      if (event_id) fallbackQuery = fallbackQuery.eq('event_id', event_id)
      if (status) fallbackQuery = fallbackQuery.eq('status', status)
      if (collected_by) fallbackQuery = fallbackQuery.eq('collected_by', collected_by)

      const fallbackResult = await fallbackQuery
      donations = fallbackResult.data
      error = fallbackResult.error
    }

    if (error) {
      console.error('Fetch donations error:', error)
      return NextResponse.json({ error: 'Could not fetch donations' }, { status: 500 })
    }

    const total_amount = donations.reduce((sum, d) => sum + Number(d.amount), 0)
    const verified_amount = donations
      .filter(d => d.status === 'verified')
      .reduce((sum, d) => sum + Number(d.amount), 0)

    return NextResponse.json({
      donations,
      summary: {
        total_count: donations.length,
        total_amount,
        verified_amount,
        pending_count: donations.filter(d => d.status === 'pending').length
      }
    })

  } catch (err) {
    console.error('Unexpected error fetching donations:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}