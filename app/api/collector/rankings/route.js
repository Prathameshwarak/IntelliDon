import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mandal_id = searchParams.get('mandal_id')
    const event_id = searchParams.get('event_id')

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    // Authenticate Bearer token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }

    // Fetch caller profile to verify membership in mandal
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, mandal_id')
      .eq('id', authUser.id)
      .single()

    if (callerError || !callerProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (callerProfile.mandal_id !== mandal_id && callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Access denied to this mandal' }, { status: 403 })
    }

    // 1. Fetch ONLY field collectors in this mandal (excluding admins/adhyaksha & managers)
    const { data: members, error: membersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role')
      .eq('mandal_id', mandal_id)
      .eq('role', 'collector')

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch mandal team' }, { status: 500 })
    }

    // 2. Fetch verified donations for this mandal (and event if selected)
    let donationsQuery = supabaseAdmin
      .from('donations')
      .select('id, amount, payment_mode, status, collected_by, event_id')
      .eq('mandal_id', mandal_id)
      .eq('status', 'verified')

    if (event_id && event_id !== 'all') {
      donationsQuery = donationsQuery.eq('event_id', event_id)
    }

    const { data: donations, error: donationsError } = await donationsQuery
    if (donationsError) {
      console.error('Error fetching donations:', donationsError)
      return NextResponse.json({ error: 'Failed to fetch collection data' }, { status: 500 })
    }

    // 3. Aggregate collections ONLY for collectors
    const collectorMap = {}

    // Initialize map ONLY with field collectors (role = 'collector')
    const teamMembers = members || []
    teamMembers.forEach(m => {
      collectorMap[m.id] = {
        id: m.id,
        name: m.full_name || 'Unnamed Collector',
        role: m.role,
        totalCash: 0,
        totalUpi: 0,
        totalAmount: 0,
        donationsCount: 0
      }
    })

    // Process verified donations for collectors
    const verifiedDonations = donations || []
    verifiedDonations.forEach(d => {
      const collectorId = d.collected_by
      if (collectorId && collectorMap[collectorId]) {
        const amt = Number(d.amount) || 0
        if (d.payment_mode === 'cash') {
          collectorMap[collectorId].totalCash += amt
        } else {
          collectorMap[collectorId].totalUpi += amt
        }
        collectorMap[collectorId].totalAmount += amt
        collectorMap[collectorId].donationsCount += 1
      }
    })

    // 4. Convert to array and sort by totalAmount descending, then donationsCount descending
    const rankingsList = Object.values(collectorMap)
      .sort((a, b) => {
        if (b.totalAmount !== a.totalAmount) {
          return b.totalAmount - a.totalAmount
        }
        return b.donationsCount - a.donationsCount
      })
      .map((c, index) => ({
        ...c,
        rank: index + 1,
        isSelf: c.id === authUser.id
      }))

    // Find caller rank position if caller is a collector
    const selfRankItem = rankingsList.find(r => r.isSelf)
    const userRank = selfRankItem ? {
      rank: selfRankItem.rank,
      totalCollectors: rankingsList.length,
      totalAmount: selfRankItem.totalAmount,
      donationsCount: selfRankItem.donationsCount,
      totalCash: selfRankItem.totalCash,
      totalUpi: selfRankItem.totalUpi
    } : null

    // 5. Fetch mandal events for dropdown filter
    const { data: events } = await supabaseAdmin
      .from('events')
      .select('id, name, year')
      .eq('mandal_id', mandal_id)
      .order('year', { ascending: false })

    return NextResponse.json({
      rankings: rankingsList,
      userRank,
      events: events || []
    })

  } catch (err) {
    console.error('Unexpected error in rankings route:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
