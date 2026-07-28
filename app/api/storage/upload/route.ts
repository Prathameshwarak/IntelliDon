import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentKey = formData.get('documentKey') as string | null
    const mandalId = formData.get('mandalId') as string | null
    const bucket = (formData.get('bucket') as string) || 'mandal-documents'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${documentKey || 'doc'}_${mandalId || 'temp'}_${Date.now()}.${fileExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type || 'image/png',
        upsert: true,
      })

    if (uploadError || !uploadData) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: uploadError?.message || 'Could not upload document' }, { status: 500 })
    }

    const path = uploadData.path

    // Update mandal record in DB if mandalId and documentKey provided
    if (mandalId && documentKey) {
      const allowedKeys = [
        'doc_logo',
        'doc_admin_aadhaar',
        'doc_bank_proof',
        'doc_auth_letter',
        'doc_address_proof',
        'doc_reg_cert',
        'doc_admin_pan',
        'doc_org_pan',
      ]
      if (allowedKeys.includes(documentKey)) {
        await supabaseAdmin
          .from('mandals')
          .update({ [documentKey]: path, submitted_at: new Date().toISOString() })
          .eq('id', mandalId)
      }
    }

    return NextResponse.json({ success: true, path, fileName })
  } catch (err: any) {
    console.error('Unexpected error in /api/storage/upload:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
