import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getOrSetCache } from '@/lib/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    const cacheKey = `me_route:${token}`
    const result = await getOrSetCache(cacheKey, async () => {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (authError || !user) {
        return null
      }

      // Query user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .select(`
          id,
          full_name,
          phone,
          role,
          is_active,
          mandal_id,
          mandals!users_mandal_id_fkey (
            id,
            name,
            slug,
            status,
            kyc_status
          )
        `)
        .eq('id', user.id)
        .single()

      let userProfile = profile
      if (profileError && profileError.message.includes('is_active')) {
        const { data: fallbackProfile } = await supabaseAdmin
          .from('users')
          .select(`
            id,
            full_name,
            phone,
            role,
            mandal_id,
            mandals!users_mandal_id_fkey (
              id,
              name,
              slug,
              status,
              kyc_status
            )
          `)
          .eq('id', user.id)
          .single()

        if (fallbackProfile) {
          userProfile = {
            ...fallbackProfile,
            is_active: true,
          }
        }
      }

      const mandalsData = userProfile?.mandals as unknown as { id: string; name: string; slug: string; status: string; kyc_status: string }[] | { id: string; name: string; slug: string; status: string; kyc_status: string } | null
      const mandalObj = Array.isArray(mandalsData) ? mandalsData[0] : mandalsData

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
        },
        profile: {
          id: userProfile?.id || user.id,
          full_name: userProfile?.full_name || '',
          phone: userProfile?.phone || '',
          role: userProfile?.role || '',
          is_active: userProfile?.is_active ?? true,
          mandal_id: userProfile?.mandal_id || null,
        },
        mandal: mandalObj ? {
          id: mandalObj.id,
          name: mandalObj.name,
          slug: mandalObj.slug,
          status: mandalObj.status,
          kyc_status: mandalObj.kyc_status,
        } : null
      }
    }, 30)

    if (!result) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' }
    })
  } catch (err: any) {
    console.error('Unexpected error in GET /api/auth/me:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
