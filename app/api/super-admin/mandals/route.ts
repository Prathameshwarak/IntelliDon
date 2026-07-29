import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isOTPVerified } from '@/lib/otp-store'

// Use the SERVICE ROLE key to bypass Row Level Security (RLS) on administrative tasks
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

// GET all mandals - super admin sees pending + active + suspended
export async function GET(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

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
        doc_logo,
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
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { mandalId, action, plan = 'trial', kycStatus, kycNotes, documentKey, documentPath } = body

    // Update document path if provided
    if (documentKey && documentPath) {
      const allowedKeys = [
        'doc_logo',
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

    if (!mandalId) {
      return NextResponse.json({ error: 'mandalId is required' }, { status: 400 })
    }

    // Fetch current target mandal status for state transition enforcement
    const { data: targetMandal, error: fetchErr } = await supabaseAdmin
      .from('mandals')
      .select('id, status, kyc_status, doc_logo, doc_admin_aadhaar, doc_bank_proof, doc_auth_letter, doc_address_proof, doc_reg_cert, doc_admin_pan, doc_org_pan, kyc_notes')
      .eq('id', mandalId)
      .single()

    if (fetchErr || !targetMandal) {
      return NextResponse.json({ error: 'Mandal not found' }, { status: 404 })
    }

    // Rule 1: Rejected organizations can ONLY transition to Pending or In Review
    if (targetMandal.kyc_status === 'rejected') {
      if (action === 'approve' || kycStatus === 'approved') {
        return NextResponse.json(
          { error: 'Rejected organizations cannot be approved directly. They must be moved to Pending or In Review first.' },
          { status: 400 }
        )
      }
      if (action === 'suspend') {
        return NextResponse.json(
          { error: 'Rejected organizations cannot be suspended.' },
          { status: 400 }
        )
      }
    }

    // Rule 2: Active/Approved organizations can ONLY transition to Suspended
    if (targetMandal.status === 'active') {
      if (action === 'reject' || kycStatus === 'rejected') {
        return NextResponse.json(
          { error: 'Active/Approved organizations cannot be rejected directly. Suspend the organization instead.' },
          { status: 400 }
        )
      }
    }

    // Check if approving mandal or setting KYC status to approved
    if (action === 'approve' || kycStatus === 'approved') {
      let currentDocStatuses: Record<string, string> = {}
      try {
        const notesStr = kycNotes || targetMandal.kyc_notes
        if (notesStr) {
          const parsed = JSON.parse(notesStr)
          if (parsed && typeof parsed.documentStatuses === 'object') {
            currentDocStatuses = parsed.documentStatuses
          }
        }
      } catch (e) {
        // Ignore parse error
      }

      const docFields = [
        { key: 'doc_logo', label: 'Organisation Logo' },
        { key: 'doc_admin_aadhaar', label: 'Admin Aadhaar' },
        { key: 'doc_bank_proof', label: 'Bank Proof' },
        { key: 'doc_auth_letter', label: 'Auth Letter / Resolution' },
        { key: 'doc_address_proof', label: 'Address Proof' },
        { key: 'doc_reg_cert', label: 'Registration Certificate' },
        { key: 'doc_admin_pan', label: 'Admin PAN' },
        { key: 'doc_org_pan', label: 'Organisation PAN' },
      ]

      const unapprovedUploaded: string[] = []
      for (const doc of docFields) {
        const filePath = targetMandal[doc.key as keyof typeof targetMandal]
        if (filePath && typeof filePath === 'string' && filePath.trim() !== '') {
          if (currentDocStatuses[doc.key] !== 'approved') {
            unapprovedUploaded.push(doc.label)
          }
        }
      }

      if (unapprovedUploaded.length > 0) {
        return NextResponse.json(
          { error: `Cannot approve organization: All uploaded documents must be approved first. Missing approval for: ${unapprovedUploaded.join(', ')}` },
          { status: 400 }
        )
      }
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

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'active' : action === 'suspend' ? 'suspended' : 'pending'

    // Determine KYC status based on the action
    const updatePayload: Record<string, any> = { status: newStatus }
    if (action === 'approve') {
      updatePayload.kyc_status = 'approved'
      if (kycNotes) {
        updatePayload.kyc_notes = kycNotes
      }
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
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const {
      name,
      address,
      city,
      state = 'Maharashtra',
      pincode,
      phone,
      orgEmail,
      upiId,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword,
      autoApprove
    } = body

    if (!name || !address || !city || !pincode || !phone || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Missing required registration details' }, { status: 400 })
    }

    if (adminPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const cleanAdminPhone = (adminPhone || phone).replace(/[^0-9]/g, '')

    if (cleanPhone.length !== 10 || cleanAdminPhone.length !== 10) {
      return NextResponse.json({ error: 'Phone numbers must be valid 10-digit numbers.' }, { status: 400 })
    }

    const cleanOrgEmail = orgEmail ? orgEmail.trim().toLowerCase() : ''
    const cleanAdminEmail = adminEmail ? adminEmail.trim().toLowerCase() : ''

    // Server-Side OTP Verification Check
    if (cleanOrgEmail && !(await isOTPVerified(cleanOrgEmail))) {
      return NextResponse.json({ error: 'Security Exception: Organization email has not been verified via OTP.' }, { status: 403 })
    }

    if (!cleanAdminEmail || !(await isOTPVerified(cleanAdminEmail))) {
      return NextResponse.json({ error: 'Security Exception: Admin email has not been verified via OTP.' }, { status: 403 })
    }

    // Check if email already registered
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const emailTaken = existingAuth?.users?.some(u => u.email?.toLowerCase() === cleanAdminEmail)
    if (emailTaken) {
      return NextResponse.json({ error: 'This admin email is already registered' }, { status: 409 })
    }

    // Check if phone numbers already registered
    const { data: existingPhones } = await supabaseAdmin
      .from('mandals')
      .select('id')
      .or(`phone.eq.${cleanPhone},admin_phone.eq.${cleanPhone},phone.eq.${cleanAdminPhone},admin_phone.eq.${cleanAdminPhone}`)
      .limit(1)

    if (existingPhones && existingPhones.length > 0) {
      return NextResponse.json({ error: 'A Mandal or Admin is already registered with this phone number.' }, { status: 409 })
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
        state: state || 'Maharashtra',
        pincode,
        phone: cleanPhone,
        org_email: cleanOrgEmail || null,
        upi_id: upiId || null,
        admin_full_name: adminName,
        admin_email: cleanAdminEmail,
        admin_phone: cleanAdminPhone,
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
