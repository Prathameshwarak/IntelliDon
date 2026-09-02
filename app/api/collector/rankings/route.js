import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getCachedAuthUserAndProfile, isAuthError } from '@/lib/auth-cache'
import { getOrSetCache } from '@/lib/cache'

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

    // Authenticate Bearer token using auth-cache
    const authResult = await getCachedAuthUserAndProfile(request, supabaseAdmin)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const authUser = authResult.user
    const callerProfile = authResult.profile

    if (!callerProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (callerProfile.mandal_id !== mandal_id && callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Access denied to this mandal' }, { status: 403 })
    }

    // Fetch and calculate base data with short-lived in-memory cache (30s)
    const cacheKey = `rankings:${mandal_id}:${event_id || 'all'}`
    const cachedData = await getOrSetCache(cacheKey, async () => {
      // 1. Fetch ONLY field collectors in this mandal (excluding admins/adhyaksha & managers)
      const { data: members, error: membersError } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role')
        .eq('mandal_id', mandal_id)
        .eq('role', 'collector')

      if (membersError) {
        console.error('Error fetching members:', membersError)
        throw new Error('Failed to fetch mandal team')
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
        throw new Error('Failed to fetch collection data')
      }

      // 3. Aggregate collections ONLY for collectors
      const collectorMap = {}

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

      // Convert to sorted array
      const rawRankings = Object.values(collectorMap)
        .sort((a, b) => {
          if (b.totalAmount !== a.totalAmount) {
            return b.totalAmount - a.totalAmount
          }
          return b.donationsCount - a.donationsCount
        })

      // 5. Fetch mandal events for dropdown filter
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('id, name, year')
        .eq('mandal_id', mandal_id)
        .order('year', { ascending: false })

      return {
        rawRankings,
        events: events || []
      }
    }, 30)

    // Customize isSelf and userRank per user dynamically from cached calculations
    const rankingsList = cachedData.rawRankings.map((c, index) => ({
      ...c,
      rank: index + 1,
      isSelf: c.id === authUser.id
    }))

    const selfRankItem = rankingsList.find(r => r.isSelf)
    const userRank = selfRankItem ? {
      rank: selfRankItem.rank,
      totalCollectors: rankingsList.length,
      totalAmount: selfRankItem.totalAmount,
      donationsCount: selfRankItem.donationsCount,
      totalCash: selfRankItem.totalCash,
      totalUpi: selfRankItem.totalUpi
    } : null

    return NextResponse.json({
      rankings: rankingsList,
      userRank,
      events: cachedData.events
    })

  } catch (err) {
    console.error('Unexpected error in rankings route:', err)
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
