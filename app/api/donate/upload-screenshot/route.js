// app/api/donate/upload-screenshot/route.js
// Public endpoint — no auth needed
// Accepts a screenshot image, uploads to Supabase storage, returns URL

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const mandalId = formData.get('mandal_id')

    if (!file || !mandalId) {
      return NextResponse.json(
        { error: 'file and mandal_id are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, or WebP images are allowed' },
        { status: 400 }
      )
    }

    // Validate file size — 5MB max
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Store under payment-screenshots/{mandal_id}/{timestamp}.jpg
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const fileName = `${Date.now()}.${ext}`
    const filePath = `${mandalId}/${fileName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment-screenshots')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Screenshot upload error:', uploadError)
      return NextResponse.json(
        { error: 'Could not upload screenshot' },
        { status: 500 }
      )
    }

    // Return signed URL — valid for 7 days (admin will verify within this window)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('payment-screenshots')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json(
        { error: 'Could not generate screenshot URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })

  } catch (err) {
    console.error('Screenshot upload unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}