import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DOC_FIELDS = [
  'doc_reg_cert',
  'doc_admin_aadhaar',
  'doc_admin_pan',
  'doc_org_pan',
  'doc_bank_proof',
  'doc_auth_letter',
  'doc_address_proof'
]

async function uploadDoc(file: File, mandalId: string, fieldName: string) {
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `${mandalId}/${fieldName}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Ensure bucket exists
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const exists = buckets?.some(b => b.name === 'kyc-documents')
    if (!exists) {
      await supabaseAdmin.storage.createBucket('kyc-documents', {
        public: false,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
        fileSizeLimit: 10 * 1024 * 1024
      })
    }
  } catch (e) {
    console.error('Error verifying/creating kyc-documents bucket:', e)
  }

  const { error } = await supabaseAdmin.storage
    .from('kyc-documents')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true
    })

  if (error) {
    console.error(`Upload error for resubmitted ${fieldName}:`, error)
    return null
  }

  return path
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session' }, { status: 401 })
    }

    const userId = authUser.id

    const formData = await request.formData()
    const mandalId = formData.get('mandal_id')?.toString().trim()

    if (!mandalId || !userId) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    // Verify user role & relationship to mandal
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', userId)
      .single()

    if (userError || !userRow || userRow.mandal_id !== mandalId || userRow.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized access to mandal' }, { status: 403 })
    }

    // Fetch current mandal to get existing KYC notes
    const { data: mandal, error: mandalFetchErr } = await supabaseAdmin
      .from('mandals')
      .select('kyc_notes')
      .eq('id', mandalId)
      .single()

    if (mandalFetchErr || !mandal) {
      return NextResponse.json({ error: 'Could not fetch organization data' }, { status: 500 })
    }

    // Parse existing kyc_notes structure
    let parsedNotes = { notes: '', documentStatuses: {} as Record<string, string> }
    if (mandal.kyc_notes) {
      try {
        const parsed = JSON.parse(mandal.kyc_notes)
        if (parsed && typeof parsed === 'object') {
          parsedNotes = {
            notes: parsed.notes || '',
            documentStatuses: parsed.documentStatuses || {}
          }
        }
      } catch (e) {
        parsedNotes.notes = mandal.kyc_notes
      }
    }

    // Parse edit text fields
    const name = formData.get('name')?.toString().trim()
    const address = formData.get('address')?.toString().trim()
    const city = formData.get('city')?.toString().trim()
    const pincode = formData.get('pincode')?.toString().trim()
    const phone = formData.get('phone')?.toString().trim()
    const upiId = formData.get('upi_id')?.toString().trim()
    const adminName = formData.get('admin_name')?.toString().trim()
    const adminPhone = formData.get('admin_phone')?.toString().trim()

    // Upload files
    const docUrls: Record<string, string> = {}
    for (const field of DOC_FIELDS) {
      const file = formData.get(field)
      if (file && typeof file !== 'string') {
        const path = await uploadDoc(file, mandalId, field)
        if (path) {
          docUrls[field] = path
          // Update status of this document to pending in the review statuses json
          parsedNotes.documentStatuses[field] = 'pending'
        }
      }
    }

    // Save document paths and reset KYC status back to pending
    const serializedNotes = JSON.stringify(parsedNotes)
    const updatePayload: Record<string, any> = {
      ...docUrls,
      status: 'pending', // Reset overall status to pending for super admin review list
      kyc_status: 'pending',
      kyc_notes: serializedNotes,
      submitted_at: new Date().toISOString()
    }

    if (name) updatePayload.name = name
    if (address !== undefined) updatePayload.address = address || null
    if (city !== undefined) updatePayload.city = city || null
    if (pincode !== undefined) updatePayload.pincode = pincode || null
    if (phone !== undefined) updatePayload.phone = phone || null
    if (upiId !== undefined) updatePayload.upi_id = upiId || null
    if (adminName) updatePayload.admin_full_name = adminName
    if (adminPhone) updatePayload.admin_phone = adminPhone

    const { error: updateError } = await supabaseAdmin
      .from('mandals')
      .update(updatePayload)
      .eq('id', mandalId)

    if (updateError) {
      console.error('Update mandal kyc docs error:', updateError)
      return NextResponse.json({ error: 'Could not update document submissions' }, { status: 500 })
    }

    // Also update users record for the administrator account
    if (adminName || adminPhone) {
      const userUpdatePayload: Record<string, any> = {}
      if (adminName) userUpdatePayload.full_name = adminName
      if (adminPhone) userUpdatePayload.phone = adminPhone

      const { error: userUpdateErr } = await supabaseAdmin
        .from('users')
        .update(userUpdatePayload)
        .eq('id', userId)

      if (userUpdateErr) {
        console.error('Failed to update administrator profile details:', userUpdateErr)
      }
    }

    return NextResponse.json({ success: true, message: 'Organization details and documents resubmitted' })

  } catch (err) {
    console.error('Unexpected error in kyc-resubmit:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
