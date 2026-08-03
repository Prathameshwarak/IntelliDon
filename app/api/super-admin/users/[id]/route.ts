import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use the SERVICE ROLE key to bypass Row Level Security (RLS) on administrative auth tasks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifySuperAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 }
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid token', status: 401 }
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || !profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden: Super admin access only', status: 403 }
  }
  return { callerId: user.id }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 1. Fetch user record from public.users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (dbError) {
      console.error('Fetch public user error:', dbError)
      return NextResponse.json({ error: 'Could not fetch user record' }, { status: 500 })
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2. Fetch auth user from auth.users (to get email, last login, and password/profile update)
    let authUser = null
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(id)
      if (!authError && authData?.user) {
        authUser = authData.user
      } else if (authError) {
        console.error('Fetch auth user error:', authError)
      }
    } catch (authErr) {
      console.error('Fetch auth user catch block error:', authErr)
    }

    // 3. Fetch designation title
    const designation = dbUser.role === 'admin' ? 'Adhyaksha (Admin)' : 'Khajindar (Collector)'

    // 4. Fetch collection activity stats (donations count and sum)
    const { data: donations, error: donError } = await supabaseAdmin
      .from('donations')
      .select('amount, status')
      .eq('collected_by', id)

    let totalCollectedCount = 0
    let totalCollectedAmount = 0
    let verifiedCollectedCount = 0
    let verifiedCollectedAmount = 0

    if (donations) {
      totalCollectedCount = donations.length
      donations.forEach((d: { amount: number; status: string }) => {
        totalCollectedAmount += d.amount
        if (d.status === 'verified') {
          verifiedCollectedCount++
          verifiedCollectedAmount += d.amount
        }
      })
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        full_name: dbUser.full_name,
        phone: dbUser.phone,
        role: dbUser.role,
        is_active: dbUser.is_active ?? true,
        created_at: dbUser.created_at,
        designation,
        email: authUser?.email || '—',
        last_login: authUser?.last_sign_in_at || null,
        password_change: authUser?.updated_at || null,
        activity: {
          totalCount: totalCollectedCount,
          totalAmount: totalCollectedAmount,
          verifiedCount: verifiedCollectedCount,
          verifiedAmount: verifiedCollectedAmount
        }
      }
    })
  } catch (err: any) {
    console.error('Unexpected error in super admin user details api:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - reset user password
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { password, email } = body

    if (!id || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    let targetUserId = id
    if (email) {
      const cleanEmail = email.trim().toLowerCase()
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
      const match = authUsers?.users?.find((u) => u.email && u.email.trim().toLowerCase() === cleanEmail)
      if (match) {
        targetUserId = match.id
      }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: password
    })

    if (error) {
      console.error('Reset password auth error:', error)
      return NextResponse.json({ error: error.message || 'Could not update password' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err: any) {
    console.error('Unexpected error in PATCH users reset password:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 550 })
  }
}
