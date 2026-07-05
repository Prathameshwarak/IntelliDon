import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// In-memory rate limiting store
const rateLimitMap = new Map()

function rateLimit(key, limit = 5, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs }

  if (now > record.resetTime) {
    record.count = 1
    record.resetTime = now + windowMs
  } else {
    record.count++
  }

  rateLimitMap.set(key, record)

  if (record.count > limit) {
    return {
      limited: true,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    }
  }

  return { limited: false }
}

export async function PATCH(request) {
  try {
    // 1. Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
    const limitResult = rateLimit(ip, 10, 60000) // 10 requests per minute limit
    if (limitResult.limited) {
      return NextResponse.json(
        { error: `Too many requests. Please try again after ${limitResult.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter) } }
      )
    }

    // 2. Validate session from Authorization Header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user: authCaller }, error: callerAuthError } = await supabaseAdmin.auth.getUser(token)
    
    if (callerAuthError || !authCaller) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
    }

    // Fetch caller's details
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', authCaller.id)
      .single()

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Caller profile not found' }, { status: 403 })
    }

    // 3. Verify caller is Admin
    if (callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only Admins can reset passwords' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, new_password } = body

    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id and new_password are required' }, { status: 400 })
    }

    // 4. Validate password complexity (at least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
    const hasLength = new_password.length >= 8
    const hasUpper = /[A-Z]/.test(new_password)
    const hasLower = /[a-z]/.test(new_password)
    const hasNumber = /[0-9]/.test(new_password)
    const hasSpecial = /[^A-Za-z0-9]/.test(new_password)

    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.' },
        { status: 400 }
      )
    }

    // 5. Fetch target user profile
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', user_id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // 6. Verify target user belongs to same mandal
    if (targetProfile.mandal_id !== callerProfile.mandal_id) {
      return NextResponse.json({ error: 'Forbidden: Target user belongs to a different mandal' }, { status: 403 })
    }

    // 7. Verify target user role (only Manager and Collector are allowed)
    if (!['manager', 'collector'].includes(targetProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Cannot reset password for this user role' }, { status: 403 })
    }

    // 8. Update password via Supabase Auth Admin API
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
