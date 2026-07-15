import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use the SERVICE ROLE key to bypass Row Level Security (RLS) on administrative tasks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET all mandals - super admin sees pending + active + suspended
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending' // default: show pending

    let query = supabaseAdmin
      .from('mandals')
      .select(`
        id,
        name,
        slug,
        address,
        city,
        phone,
        status,
        created_at,
        admin_full_name,
        admin_email,
        admin_phone,
        pincode,
        upi_id,
        doc_reg_cert,
        doc_admin_aadhaar,
        doc_admin_pan,
        doc_org_pan,
        doc_bank_proof,
        doc_auth_letter,
        doc_address_proof,
        kyc_status,
        kyc_notes,
        users!users_mandal_id_fkey (
          id,
          full_name,
          phone,
          role
        ),
        subscriptions (
          plan,
          status,
          ends_at
        )
      `)

    let sortingColumn = 'created_at'
    let ascending = false

    if (status === 'pending') {
      query = query.eq('status', 'pending').neq('kyc_status', 'rejected')
    } else if (status === 'rejected') {
      query = query.eq('status', 'pending').eq('kyc_status', 'rejected')
    } else if (status === 'all') {
      sortingColumn = 'name'
      ascending = true
    } else {
      query = query.eq('status', status)
    }

    const { data: mandals, error } = await query.order(sortingColumn, { ascending })

    if (error) {
      console.error('Fetch mandals error:', error)
      return NextResponse.json({ error: 'Could not fetch mandals' }, { status: 500 })
    }

    return NextResponse.json({ mandals })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - approve, reject, or suspend a mandal
// Body: { mandalId: string, action?: 'approve' | 'reject' | 'suspend', plan?: string, documentKey?: string, documentPath?: string }
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { mandalId, action, plan = 'trial', kycStatus, kycNotes, documentKey, documentPath } = body

    // Update document path if provided
    if (documentKey && documentPath) {
      const allowedKeys = [
        'doc_admin_aadhaar',
        'doc_bank_proof',
        'doc_auth_letter',
        'doc_address_proof',
        'doc_reg_cert',
        'doc_admin_pan',
        'doc_org_pan'
      ]
      if (!allowedKeys.includes(documentKey)) {
        return NextResponse.json({ error: 'Invalid document key' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('mandals')
        .update({ [documentKey]: documentPath })
        .eq('id', mandalId)

      if (error) {
        console.error('Update document DB error:', error)
        return NextResponse.json({ error: 'Could not update document record' }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'Document updated successfully' })
    }

    // KYC update — separate from approve/reject action
    if (kycStatus) {
      const { error } = await supabaseAdmin
        .from('mandals')
        .update({
          kyc_status: kycStatus,
          kyc_notes: kycNotes || null,
          kyc_reviewed_at: new Date().toISOString()
        })
        .eq('id', mandalId)

      if (error) return NextResponse.json({ error: 'Could not update KYC status' }, { status: 500 })
      return NextResponse.json({ success: true, message: `KYC ${kycStatus}` })
    }

    if (!mandalId || !action) {
      return NextResponse.json({ error: 'mandalId and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'active' : action === 'suspend' ? 'suspended' : 'pending'

    // Determine KYC status based on the action
    const updatePayload: Record<string, any> = { status: newStatus }
    if (action === 'approve') {
      updatePayload.kyc_status = 'approved'
    } else if (action === 'reject') {
      updatePayload.kyc_status = 'rejected'
      if (kycNotes) {
        updatePayload.kyc_notes = kycNotes
      }
    }

    // Update mandal status and KYC status
    const { error: updateError } = await supabaseAdmin
      .from('mandals')
      .update(updatePayload)
      .eq('id', mandalId)

    if (updateError) {
      console.error('Update mandal error:', updateError)
      return NextResponse.json({ error: 'Could not update mandal' }, { status: 500 })
    }

    // If approving - create a subscription row for them if it doesn't already exist
    if (action === 'approve') {
      const trialDays = 30
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + trialDays)

      // Check if subscription already exists (don't double-create)
      const { data: existing, error: findSubError } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('mandal_id', mandalId)
        .maybeSingle()

      if (findSubError) {
        console.error('Error checking existing subscription:', findSubError)
      }

      if (!existing) {
        const { error: subError } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            mandal_id: mandalId,
            plan: plan,
            status: 'active',
            ends_at: endsAt.toISOString()
          })

        if (subError) {
          console.error('Subscription create error:', subError)
          // Don't fail the whole request - mandal is approved, subscription can be fixed manually
        }
      }
    }

    const formattedAction = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended'

    return NextResponse.json({
      success: true,
      message: `Mandal ${formattedAction} successfully`,
      newStatus
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 550 })
  }
}

// POST create a new organization by super admin
export async function POST(request: Request) {
  // Check super-admin access
  const authHeader = request.headers.get('Authorization')
  let callerId = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (!authError && user) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile && profile.role === 'super_admin') {
        callerId = user.id
      }
    }
  }

  if (!callerId) {
    // Let's verify auth session via current cookies as fallback
    const { data: { session } } = await supabaseAdmin.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()
      if (profile && profile.role === 'super_admin') {
        callerId = session.user.id
      }
    }
  }

  // If still not verified, try listing user logic or default fallback (for simplicity of testing we allow if headers fail but session is active)
  if (!callerId) {
    // Let's try parsing session token from cookies
    // To ensure admin works seamlessly, we default callerId to a valid check or throw
    // (the client will send Bearer Authorization token automatically in headers)
    return NextResponse.json({ error: 'Unauthorized: Super admin access only' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      address,
      city,
      pincode,
      phone,
      upiId,
      adminName,
      adminEmail,
      adminPassword,
      autoApprove
    } = body

    if (!name || !address || !city || !pincode || !phone || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Missing required registration details' }, { status: 400 })
    }

    if (adminPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if email already registered
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const emailTaken = existingAuth?.users?.some(u => u.email === adminEmail)
    if (emailTaken) {
      return NextResponse.json({ error: 'This email is already registered' }, { status: 409 })
    }

    // Generate slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // Create Mandal row
    const mandalStatus = autoApprove ? 'active' : 'pending'
    const kycStatus = autoApprove ? 'approved' : 'pending'

    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .insert({
        name,
        slug,
        org_type: 'mandal',
        address,
        city,
        state: 'Maharashtra',
        pincode,
        phone,
        upi_id: upiId || null,
        admin_full_name: adminName,
        admin_email: adminEmail,
        admin_phone: phone,
        status: mandalStatus,
        kyc_status: kycStatus,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (mandalError || !mandal) {
      console.error('Mandal create error:', mandalError)
      return NextResponse.json({ error: 'Could not create organization record' }, { status: 550 })
    }

    // Create auth account
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        requires_password_change: true
      }
    })

    if (authError || !authUser.user) {
      console.error('Auth account create error:', authError)
      // Rollback mandal
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      return NextResponse.json({ error: authError?.message || 'Could not create administrator account' }, { status: 500 })
    }

    // Create user profile
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id: mandal.id,
        full_name: adminName,
        phone,
        role: 'admin'
      })

    if (userError) {
      console.error('User profile create error:', userError)
      // Rollback auth user and mandal
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      return NextResponse.json({ error: 'Could not create administrator profile record' }, { status: 500 })
    }

    // Auto-create a subscription if auto-approved
    if (autoApprove) {
      const trialDays = 30
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + trialDays)
      await supabaseAdmin.from('subscriptions').insert({
        mandal_id: mandal.id,
        plan: 'trial',
        status: 'active',
        ends_at: endsAt.toISOString()
      })
    }

    return NextResponse.json({ success: true, message: 'Organization created successfully', mandal })
  } catch (err) {
    console.error('Unexpected error in mandal creation:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
