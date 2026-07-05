import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { canUseFeature } from '@/lib/subscription'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET — fetch all team members for a mandal
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mandal_id = searchParams.get('mandal_id')

  if (!mandal_id) return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })

  const { data: members, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, phone, role, created_at')
    .eq('mandal_id', mandal_id)
    .order('role')

  if (error) return NextResponse.json({ error: 'Could not fetch team' }, { status: 500 })

  return NextResponse.json({ members })
}

// POST — add a new collector or manager
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, full_name, phone, email, password, role } = body

    if (!mandal_id || !full_name || !phone || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const isSubscribed = await canUseFeature(mandal_id, 'team')
    if (!isSubscribed) {
      return NextResponse.json({ error: 'Subscription expired or inactive. Upgrade to add team members.' }, { status: 403 })
    }

    if (!['collector', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Role must be collector or manager' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Create auth account
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Create users row
    const { data: member, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id,
        full_name,
        phone,
        role
      })
      .select()
      .single()

    if (userError) {
      // Rollback auth account
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: 'Could not create team member' }, { status: 500 })
    }

    return NextResponse.json({ success: true, member })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — remove a team member
export async function DELETE(request) {
  try {
    const body = await request.json()
    const { user_id } = body

    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

    // Delete from users table first, then auth
    await supabaseAdmin.from('users').delete().eq('id', user_id)
    await supabaseAdmin.auth.admin.deleteUser(user_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}