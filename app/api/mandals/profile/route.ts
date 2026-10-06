import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Structured address components live in mandals.address_details (jsonb).
// The existing flat `address` text column is kept in sync (single-line,
// derived) so receipts / KYC / anything else still reading `mandal.address`
// keeps working unchanged.
type AddressDetails = {
  room_no?: string
  floor_no?: string
  building_name?: string
  colony_name?: string
  street_name?: string
  area_name?: string
}

function buildFlatAddress(details: AddressDetails): string {
  const parts = [
    details.room_no,
    details.floor_no,
    details.building_name,
    details.colony_name,
    details.street_name,
    details.area_name,
  ].filter(v => v && v.trim())
  return parts.join(', ')
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 as const }
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid session', status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, role, mandal_id, full_name, phone, email')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Forbidden: Requester profile not found', status: 403 as const }
  }
  if (!['admin', 'manager'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403 as const }
  }

  return { userId: user.id, authEmail: user.email || null, caller: profile }
}

const MANDAL_SELECT = `
  id, name, phone, org_email, website, address, address_details, city, state, country, pincode,
  doc_logo, admin_full_name, admin_email, admin_phone, upi_id, status, kyc_status,
  kyc_notes, doc_reg_cert, doc_admin_aadhaar, doc_admin_pan, doc_org_pan, doc_bank_proof, doc_auth_letter, doc_address_proof
`

// ── GET — organization profile + administrator profile ─────────
export async function GET(request: Request) {
  try {
    const authCheck = await authenticate(request)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    const { data: mandal, error } = await supabaseAdmin
      .from('mandals')
      .select(MANDAL_SELECT)
      .eq('id', authCheck.caller.mandal_id)
      .single()

    if (error || !mandal) {
      return NextResponse.json({ error: 'Could not fetch organization profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: mandal.id,
        name: mandal.name,
        phone: mandal.phone,
        org_email: mandal.org_email,
        website: mandal.website,
        address: mandal.address,
        address_details: mandal.address_details || {},
        city: mandal.city,
        state: mandal.state,
        country: mandal.country,
        pincode: mandal.pincode,
        doc_logo: mandal.doc_logo,
        status: mandal.status,
        kyc_status: mandal.kyc_status,
      },
      administrator: {
        // Prefer the caller's own user row (source of truth for login/profile),
        // fall back to the mandal's mirrored admin_* fields for display.
        full_name: authCheck.caller.full_name || mandal.admin_full_name || '',
        email: authCheck.caller.email || mandal.admin_email || authCheck.authEmail || '',
        phone: authCheck.caller.phone || mandal.admin_phone || '',
        role: authCheck.caller.role,
      },
      kyc: {
        status: mandal.kyc_status,
        notes: mandal.kyc_notes,
        documents: {
          doc_reg_cert: mandal.doc_reg_cert,
          doc_admin_aadhaar: mandal.doc_admin_aadhaar,
          doc_admin_pan: mandal.doc_admin_pan,
          doc_org_pan: mandal.doc_org_pan,
          doc_bank_proof: mandal.doc_bank_proof,
          doc_auth_letter: mandal.doc_auth_letter,
          doc_address_proof: mandal.doc_address_proof,
        },
      },
    })
  } catch (err) {
    console.error('Unexpected error in GET /api/mandals/profile:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — update organization profile OR administrator profile ─
// body: { section: 'organization' | 'administrator', ...fields }
export async function PATCH(request: Request) {
  try {
    const authCheck = await authenticate(request)
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }
    // Only the organization admin (Adhyaksha) can edit — managers have read-only access.
    if (authCheck.caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only the organization admin can edit this' }, { status: 403 })
    }

    const body = await request.json()
    const section = body.section

    if (section === 'organization') {
      const {
        name, phone, org_email, website,
        country, state, city, pincode,
        address_details,
      } = body

      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Organization / Mandal name is required' }, { status: 400 })
      }
      if (!phone || !phone.trim()) {
        return NextResponse.json({ error: 'Contact number is required' }, { status: 400 })
      }
      if (!country || !country.trim()) {
        return NextResponse.json({ error: 'Country is required' }, { status: 400 })
      }
      if (!state || !state.trim()) {
        return NextResponse.json({ error: 'State is required' }, { status: 400 })
      }
      if (!city || !city.trim()) {
        return NextResponse.json({ error: 'City is required' }, { status: 400 })
      }
      if (!pincode || !pincode.trim()) {
        return NextResponse.json({ error: 'Pincode is required' }, { status: 400 })
      }

      const details: AddressDetails = address_details && typeof address_details === 'object' ? address_details : {}

      const updatePayload: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim(),
        org_email: org_email ? org_email.trim() : null,
        website: website ? website.trim() : null,
        country: country.trim(),
        state: state.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        address_details: details,
        address: buildFlatAddress(details),
      }

      const { data, error } = await supabaseAdmin
        .from('mandals')
        .update(updatePayload)
        .eq('id', authCheck.caller.mandal_id)
        .select(MANDAL_SELECT)
        .single()

      if (error) {
        console.error('Organization profile update error:', error)
        // If address_details column doesn't exist yet (migration not applied), retry without it
        if (error.message && error.message.includes('address_details')) {
          const { name: _n, address_details: _ad, ...rest } = updatePayload
          const { data: fallback, error: fallbackErr } = await supabaseAdmin
            .from('mandals')
            .update({ ...rest, name: updatePayload.name })
            .eq('id', authCheck.caller.mandal_id)
            .select(MANDAL_SELECT)
            .single()
          if (fallbackErr) {
            return NextResponse.json({ error: 'Could not update organization profile' }, { status: 500 })
          }
          return NextResponse.json({ success: true, organization: fallback })
        }
        return NextResponse.json({ error: 'Could not update organization profile' }, { status: 500 })
      }

      return NextResponse.json({ success: true, organization: data })
    }

    if (section === 'administrator') {
      const { full_name, email, phone } = body

      if (!full_name || !full_name.trim()) {
        return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
      }
      if (!phone || !phone.trim()) {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
      }

      // Update the admin's own user row (source of truth for the app profile)
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({
          full_name: full_name.trim(),
          phone: phone.trim(),
          ...(email !== undefined ? { email: email ? email.trim() : null } : {}),
        })
        .eq('id', authCheck.userId)

      if (userError) {
        console.error('Administrator profile (users) update error:', userError)
        return NextResponse.json({ error: 'Could not update administrator profile' }, { status: 500 })
      }

      // Mirror onto the mandal record so anything reading admin_* stays consistent
      await supabaseAdmin
        .from('mandals')
        .update({
          admin_full_name: full_name.trim(),
          admin_phone: phone.trim(),
          ...(email !== undefined ? { admin_email: email ? email.trim() : null } : {}),
        })
        .eq('id', authCheck.caller.mandal_id)

      return NextResponse.json({
        success: true,
        administrator: { full_name: full_name.trim(), phone: phone.trim(), email: email ?? authCheck.caller.email },
        note: 'This updates your contact profile. It does not change your login email/credentials.',
      })
    }

    return NextResponse.json({ error: 'Unknown section — expected "organization" or "administrator"' }, { status: 400 })
  } catch (err) {
    console.error('Unexpected error in PATCH /api/mandals/profile:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
