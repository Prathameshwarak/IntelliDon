// app/api/mandals/register/route.js
// Handles multipart/form-data (not JSON) because documents are uploaded as files

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Document fields expected from the form ────────────────────
const DOC_FIELDS = [
  'doc_reg_cert',       // registration certificate (optional)
  'doc_admin_aadhaar',  // admin aadhaar (required)
  'doc_admin_pan',      // admin PAN (optional)
  'doc_org_pan',        // org PAN (optional)
  'doc_bank_proof',     // bank proof (required)
  'doc_auth_letter',    // auth letter / committee resolution (required)
  'doc_address_proof',  // address proof (required)
]

const REQUIRED_DOCS = [
  'doc_admin_aadhaar',
  'doc_bank_proof',
  'doc_auth_letter',
  'doc_address_proof',
]

// ── Upload one document file to kyc-documents bucket ──────────
async function uploadDoc(file, mandalId, fieldName) {
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `${mandalId}/${fieldName}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabaseAdmin.storage
    .from('kyc-documents')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true
    })

  if (error) {
    console.error(`Upload error for ${fieldName}:`, error)
    return null
  }

  // Return the storage path (not a public URL — super admin accesses via signed URL)
  return path
}

export async function POST(request) {
  try {
    // ── Parse multipart form data ───────────────────────────
    const formData = await request.formData()

    // Text fields
    const name         = formData.get('name')?.toString().trim()
    const orgType      = formData.get('org_type')?.toString().trim() || 'mandal'
    const address      = formData.get('address')?.toString().trim()
    const city         = formData.get('city')?.toString().trim()
    const state        = formData.get('state')?.toString().trim() || 'Maharashtra'
    const pincode      = formData.get('pincode')?.toString().trim()
    const phone        = formData.get('phone')?.toString().trim()
    const upiId        = formData.get('upi_id')?.toString().trim()
    const adminName    = formData.get('admin_name')?.toString().trim()
    const adminEmail   = formData.get('admin_email')?.toString().trim()
    const adminPhone   = formData.get('admin_phone')?.toString().trim()
    const adminPassword = formData.get('admin_password')?.toString()

    // ── Validate required text fields ───────────────────────
    const missing = []
    if (!name)          missing.push('Organisation name')
    if (!address)       missing.push('Address')
    if (!city)          missing.push('City')
    if (!pincode)       missing.push('Pincode')
    if (!phone)         missing.push('Phone')
    if (!adminName)     missing.push('Admin full name')
    if (!adminEmail)    missing.push('Admin email')
    if (!adminPhone)    missing.push('Admin phone')
    if (!adminPassword) missing.push('Password')

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // ── Validate required documents ─────────────────────────
    const missingDocs = []
    for (const field of REQUIRED_DOCS) {
      const file = formData.get(field)
      if (!file || typeof file === 'string') {
        const labels = {
          doc_admin_aadhaar: 'Admin Aadhaar',
          doc_bank_proof: 'Bank proof (cancelled cheque / passbook)',
          doc_auth_letter: 'Admin authorisation letter / committee resolution',
          doc_address_proof: 'Address proof',
        }
        missingDocs.push(labels[field])
      }
    }

    if (missingDocs.length > 0) {
      return NextResponse.json(
        { error: `Missing required documents: ${missingDocs.join(', ')}` },
        { status: 400 }
      )
    }

    // ── Check email not already registered ──────────────────
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const emailTaken = existingAuth?.users?.some(u => u.email === adminEmail)
    if (emailTaken) {
      return NextResponse.json(
        { error: 'This email is already registered. Try logging in instead.' },
        { status: 409 }
      )
    }

    // ── Generate slug ───────────────────────────────────────
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // ── Create mandal row first (need ID for doc upload paths) ──
    const { data: mandal, error: mandalError } = await supabaseAdmin
      .from('mandals')
      .insert({
        name,
        slug,
        org_type: orgType,
        address,
        city,
        state,
        pincode,
        phone,
        upi_id: upiId || null,
        admin_full_name: adminName,
        admin_email: adminEmail,
        admin_phone: adminPhone,
        status: 'pending',
        kyc_status: 'pending',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (mandalError) {
      console.error('Mandal insert error:', mandalError)
      return NextResponse.json(
        { error: 'Could not create registration. Please try again.' },
        { status: 500 }
      )
    }

    // ── Upload documents ────────────────────────────────────
    const docUrls = {}
    for (const field of DOC_FIELDS) {
      const file = formData.get(field)
      if (file && typeof file !== 'string') {
        const path = await uploadDoc(file, mandal.id, field)
        if (path) docUrls[field] = path
      }
    }

    // Save document paths back to the mandal row
    if (Object.keys(docUrls).length > 0) {
      await supabaseAdmin
        .from('mandals')
        .update(docUrls)
        .eq('id', mandal.id)
    }

    // ── Create auth account ─────────────────────────────────
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    })

    if (authError) {
      // Roll back mandal row
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      console.error('Auth creation error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Could not create admin account' },
        { status: 500 }
      )
    }

    // ── Create users row ────────────────────────────────────
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        mandal_id: mandal.id,
        full_name: adminName,
        phone: adminPhone,
        role: 'admin'
      })

    if (userError) {
      await supabaseAdmin.from('mandals').delete().eq('id', mandal.id)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      console.error('User insert error:', userError)
      return NextResponse.json(
        { error: 'Could not finish setting up admin account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mandal: {
        id: mandal.id,
        name: mandal.name,
        slug: mandal.slug,
        status: mandal.status,
        kyc_status: mandal.kyc_status
      }
    })

  } catch (err) {
    console.error('Unexpected error in registration:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}