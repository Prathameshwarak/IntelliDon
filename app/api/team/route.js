import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper to authenticate the admin caller and verify they belong to the correct mandal
async function verifyAdminCaller(request, mandalIdToCheck = null) {
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

  if (profile.role !== 'admin') {
    return { error: 'Forbidden: Only Admins can perform this action', status: 403 }
  }

  if (mandalIdToCheck && profile.mandal_id !== mandalIdToCheck) {
    return { error: 'Forbidden: Admin does not belong to this mandal', status: 403 }
  }

  return { caller: profile, callerId: user.id }
}

// GET — fetch all team members for a mandal
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mandal_id = searchParams.get('mandal_id')

  if (!mandal_id) return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })

  // Secure GET: Confirm caller belongs to same mandal
  const authCheck = await verifyAdminCaller(request, mandal_id)
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  let { data: members, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, phone, role, is_active, created_at')
    .eq('mandal_id', mandal_id)
    .order('role')

  if (error && error.message.includes('is_active')) {
    // Fallback: If is_active column doesn't exist yet, retry query without it
    const { data: fallbackMembers, error: fallbackError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, phone, role, created_at')
      .eq('mandal_id', mandal_id)
      .order('role')

    if (fallbackError) {
      return NextResponse.json({ error: 'Could not fetch team' }, { status: 500 })
    }

    members = fallbackMembers.map(m => ({ ...m, is_active: true }))
    error = null
  } else if (error) {
    return NextResponse.json({ error: 'Could not fetch team' }, { status: 500 })
  }

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

    if (!['collector', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Role must be collector or manager' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Secure POST: Confirm caller is admin of the same mandal
    const authCheck = await verifyAdminCaller(request, mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
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

    // Create users row with is_active default to true
    const { data: member, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id,
        full_name,
        phone,
        role,
        is_active: true
      })
      .select('id, full_name, phone, role, is_active, created_at')
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

// PATCH — edit team member details or toggle activation status
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { action, user_id, full_name, phone, role, is_active } = body

    if (!user_id || !action) {
      return NextResponse.json({ error: 'user_id and action are required' }, { status: 400 })
    }

    if (!['edit', 'toggle_status'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // 1. Fetch target user to get mandal_id and check roles
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', user_id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // 2. Authenticate admin caller and verify same mandal
    const authCheck = await verifyAdminCaller(request, targetProfile.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // 3. Ensure target is collector or manager (admin cannot edit/deactivate other admins or super admins)
    if (!['collector', 'manager'].includes(targetProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Cannot manage other admins or super admins' }, { status: 403 })
    }

    if (action === 'edit') {
      if (!full_name || !phone || !role) {
        return NextResponse.json({ error: 'full_name, phone, and role are required' }, { status: 400 })
      }
      if (!['collector', 'manager'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }

      // Update in users table
      const { data: updatedMember, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ full_name, phone, role })
        .eq('id', user_id)
        .select('id, full_name, phone, role, is_active, created_at')
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Could not update team member' }, { status: 500 })
      }

      return NextResponse.json({ success: true, member: updatedMember })

    } else if (action === 'toggle_status') {
      if (typeof is_active !== 'boolean') {
        return NextResponse.json({ error: 'is_active boolean is required' }, { status: 400 })
      }

      // 1. Update is_active in users table
      const { data: updatedMember, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ is_active })
        .eq('id', user_id)
        .select('id, full_name, phone, role, is_active, created_at')
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Could not update active status' }, { status: 500 })
      }

      // 2. Ban or unban user in Supabase Auth to prevent/allow logins
      const banDuration = is_active ? 'none' : '87600h' // 'none' to unban, 10 years to ban
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { ban_duration: banDuration }
      )

      if (banError) {
        // Rollback users table status if auth status change fails
        await supabaseAdmin.from('users').update({ is_active: !is_active }).eq('id', user_id)
        return NextResponse.json({ error: `Auth status sync failed: ${banError.message}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, member: updatedMember })
    }
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

    // Fetch target user to get mandal_id and role
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', user_id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Secure DELETE: Confirm caller is admin of same mandal
    const authCheck = await verifyAdminCaller(request, targetProfile.mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Ensure target is manager or collector
    if (!['collector', 'manager'].includes(targetProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete admins or super admins' }, { status: 403 })
    }

    // Delete from users table first, then auth
    await supabaseAdmin.from('users').delete().eq('id', user_id)
    await supabaseAdmin.auth.admin.deleteUser(user_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}