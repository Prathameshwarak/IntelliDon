import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkLoginRateLimit, recordFailedAttempt, resetFailedAttempts } from '@/lib/login-rate-limiter'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Standard client for user authentication
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

// Admin client to query user profiles bypassing RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    // Extract IP address from request headers
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfIp = request.headers.get('cf-connecting-ip')
    const ip = (forwarded ? forwarded.split(',')[0] : realIp || cfIp || '127.0.0.1').trim()

    // Extract MAC address / device identifier header (or fallback to User-Agent)
    const macAddress = request.headers.get('x-mac-address') || request.headers.get('x-device-id') || request.headers.get('user-agent') || 'unknown-device'

    // Composite key combining IP address + MAC address / Device ID
    const rateLimitKey = `login_fail:${ip}:${macAddress}`

    // 1. Check rate limit BEFORE authenticating
    const rateLimitStatus = checkLoginRateLimit(rateLimitKey)
    if (!rateLimitStatus.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimitStatus.error, remainingSec: rateLimitStatus.remainingSec },
        { status: 429 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // 2. Authenticate with Supabase server-side
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    })

    if (authError || !authData.user || !authData.session) {
      // Record failed attempt
      recordFailedAttempt(rateLimitKey)
      const updatedStatus = checkLoginRateLimit(rateLimitKey)

      if (!updatedStatus.allowed) {
        return NextResponse.json(
          { success: false, error: updatedStatus.error, remainingSec: updatedStatus.remainingSec },
          { status: 429 }
        )
      }

      console.warn('Backend login auth failed:', authError?.message)
      return NextResponse.json(
        { success: false, error: authError?.message || 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Clear failed attempts on successful login
    resetFailedAttempts(rateLimitKey)

    // 3. Fetch corresponding user profile & mandal details via service role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select(`
        full_name,
        role,
        is_active,
        mandals!users_mandal_id_fkey (
          name
        )
      `)
      .eq('id', authData.user.id)
      .single()

    let userProfile = profile
    if (profileError && profileError.message.includes('is_active')) {
      // Fallback if is_active column is not present
      const { data: fallbackProfile } = await supabaseAdmin
        .from('users')
        .select(`
          full_name,
          role,
          mandals!users_mandal_id_fkey (
            name
          )
        `)
        .eq('id', authData.user.id)
        .single()

      if (fallbackProfile) {
        userProfile = {
          ...fallbackProfile,
          is_active: true,
        }
      }
    }

    // 4. Check if account is deactivated
    if (userProfile && userProfile.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'Your account has been deactivated. Please contact your Adhyaksha.' },
        { status: 403 }
      )
    }

    const mandalsData = userProfile?.mandals as unknown as { name: string }[] | { name: string } | null
    const mandalObj = Array.isArray(mandalsData) ? mandalsData[0] : mandalsData
    const mandalName = mandalObj?.name || ''

    return NextResponse.json({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
      },
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile: {
        full_name: userProfile?.full_name || '',
        role: userProfile?.role || '',
        mandal_name: mandalName,
      },
    })
  } catch (err: any) {
    console.error('Unexpected error in /api/auth/login:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication.' },
      { status: 500 }
    )
  }
}
