import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { path, bucket = 'mandal-documents', expiresIn = 3600 } = body

    if (!path) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error || !data?.signedUrl) {
      console.error('Signed URL generation error:', error)
      return NextResponse.json({ error: error?.message || 'Could not generate signed URL' }, { status: 500 })
    }

    return NextResponse.json({ success: true, signedUrl: data.signedUrl })
  } catch (err: any) {
    console.error('Unexpected error in /api/storage/signed-url:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    const bucket = searchParams.get('bucket') || 'mandal-documents'

    if (!path) {
      return NextResponse.json({ error: 'Path query param is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
    }

    return NextResponse.json({ success: true, signedUrl: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
