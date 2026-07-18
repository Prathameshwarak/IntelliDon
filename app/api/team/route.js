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
    .select('id, full_name, phone, email, role, is_active, created_at')
    .eq('mandal_id', mandal_id)
    .order('role')

  if (error && error.message.includes('is_active')) {
    // Fallback: If is_active column doesn't exist yet, retry query without it
    const { data: fallbackMembers, error: fallbackError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, phone, email, role, created_at')
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

  // Attach each member's event access (empty array = access to ALL events)
  const { data: accessRows } = await supabaseAdmin
    .from('user_event_access')
    .select('user_id, event_id')
    .eq('mandal_id', mandal_id)

  const accessByUser = {}
  for (const row of accessRows || []) {
    if (!accessByUser[row.user_id]) accessByUser[row.user_id] = []
    accessByUser[row.user_id].push(row.event_id)
  }

  members = members.map(m => ({ ...m, event_ids: accessByUser[m.id] || [] }))

  return NextResponse.json({ members })
}

// POST — add a new collector or manager
export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, full_name, phone, email, password, role, event_ids } = body

    if (!mandal_id || !full_name || !phone || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "")
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: 'Phone number must be a valid 10-digit number' }, { status: 400 })
    }

    if (!['collector', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Role must be collector or manager' }, { status: 400 })
    }

    const hasLength = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)

    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    // event_ids is optional. If provided it must be an array of strings.
    const requestedEventIds = Array.isArray(event_ids) ? [...new Set(event_ids.filter(Boolean))] : []

    // Secure POST: Confirm caller is admin of the same mandal
    const authCheck = await verifyAdminCaller(request, mandal_id)
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    // Duplicate-email guard: same mandal cannot have two members
    // sharing an email (case-insensitive).
    const { data: existingWithEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('mandal_id', mandal_id)
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existingWithEmail) {
      return NextResponse.json(
        { error: 'A team member with this email already exists in your organization' },
        { status: 409 }
      )
    }

    // Validate that any requested events actually belong to this mandal
    if (requestedEventIds.length > 0) {
      const { data: ownedEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('mandal_id', mandal_id)
        .in('id', requestedEventIds)

      if (eventsError || (ownedEvents || []).length !== requestedEventIds.length) {
        return NextResponse.json({ error: 'One or more selected events are invalid' }, { status: 400 })
      }
    }

    // Create auth account
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true
    })

    if (authError) {
      const isDuplicate = /already.*registered|already.*exists/i.test(authError.message || '')
      return NextResponse.json(
        { error: isDuplicate ? 'This email is already registered to another account' : authError.message },
        { status: isDuplicate ? 409 : 500 }
      )
    }

    // Create users row with is_active default to true
    const { data: member, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id,
        full_name,
        phone,
        email: normalizedEmail,
        role,
        is_active: true
      })
      .select('id, full_name, phone, email, role, is_active, created_at')
      .single()

    if (userError) {
      // Rollback auth account
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: 'Could not create team member' }, { status: 500 })
    }

    // Assign event access (skip entirely = access to all events)
    if (requestedEventIds.length > 0) {
      const { error: accessError } = await supabaseAdmin
        .from('user_event_access')
        .insert(requestedEventIds.map(event_id => ({
          user_id: member.id,
          event_id,
          mandal_id
        })))

      if (accessError) {
        // Member was created but access rows failed — surface this
        // clearly rather than silently leaving them with all-event access.
        return NextResponse.json({
          success: true,
          member: { ...member, event_ids: [] },
          warning: 'Member created, but event access could not be saved. Edit the member to set it.'
        })
      }
    }

    return NextResponse.json({ success: true, member: { ...member, event_ids: requestedEventIds } })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH — edit team member details or toggle activation status
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { action, user_id, full_name, phone, role, is_active, event_ids } = body

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
      const cleanPhone = phone.replace(/[^0-9]/g, "")
      if (cleanPhone.length !== 10) {
        return NextResponse.json({ error: 'Phone number must be a valid 10-digit number' }, { status: 400 })
      }
      if (!['collector', 'manager'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }

      // Update in users table
      const { data: updatedMember, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ full_name, phone, role })
        .eq('id', user_id)
        .select('id, full_name, phone, email, role, is_active, created_at')
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Could not update team member' }, { status: 500 })
      }

      // event_ids is optional in edit payload. Only touch access rows
      // if the caller explicitly sent an array (undefined = leave as-is).
      let finalEventIds = null
      if (Array.isArray(event_ids)) {
        const cleanIds = [...new Set(event_ids.filter(Boolean))]

        if (cleanIds.length > 0) {
          const { data: ownedEvents, error: eventsError } = await supabaseAdmin
            .from('events')
            .select('id')
            .eq('mandal_id', targetProfile.mandal_id)
            .in('id', cleanIds)

          if (eventsError || (ownedEvents || []).length !== cleanIds.length) {
            return NextResponse.json({ error: 'One or more selected events are invalid' }, { status: 400 })
          }
        }

        await supabaseAdmin.from('user_event_access').delete().eq('user_id', user_id)

        if (cleanIds.length > 0) {
          const { error: accessError } = await supabaseAdmin
            .from('user_event_access')
            .insert(cleanIds.map(event_id => ({
              user_id,
              event_id,
              mandal_id: targetProfile.mandal_id
            })))
          if (accessError) {
            return NextResponse.json({ error: 'Could not update event access' }, { status: 500 })
          }
        }

        finalEventIds = cleanIds
      }

      return NextResponse.json({ success: true, member: { ...updatedMember, event_ids: finalEventIds } })

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