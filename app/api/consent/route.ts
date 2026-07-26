import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/consent'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, mandalId, documentType, documentVersion } = body

    if (!documentType || !documentVersion) {
      return NextResponse.json(
        { error: 'Missing required fields: documentType and documentVersion are required' },
        { status: 400 }
      )
    }

    if (!['terms_and_conditions', 'privacy_policy'].includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid documentType. Must be terms_and_conditions or privacy_policy' },
        { status: 400 }
      )
    }

    // Extract IP address and User-Agent for evidentiary audit trail
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : req.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const payload = {
      user_id: userId || null,
      mandal_id: mandalId || null,
      document_type: documentType,
      document_version: documentVersion,
      ip_address: ip,
      user_agent: userAgent,
      accepted_at: new Date().toISOString(),
    }

    // Insert or update consent log entry
    const { data, error } = await supabaseAdmin
      .from('user_consents')
      .upsert(payload, {
        onConflict: 'user_id,document_type,document_version',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.warn('Consent log database warning:', error.message)
      // If table doesn't exist yet, we still return acknowledgment to not block users
      return NextResponse.json({
        success: true,
        logged: false,
        warning: 'Consent table notice: ' + error.message,
        payload,
      })
    }

    return NextResponse.json({
      success: true,
      logged: true,
      data: data?.[0] || payload,
    })
  } catch (err: any) {
    console.error('Consent recording error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to record consent' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const mandalId = searchParams.get('mandalId')
    const documentType = searchParams.get('documentType') || 'terms_and_conditions'
    const documentVersion = searchParams.get('documentVersion') || CURRENT_TERMS_VERSION

    if (!userId && !mandalId) {
      return NextResponse.json(
        { error: 'userId or mandalId parameter is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('user_consents')
      .select('*')
      .eq('document_type', documentType)
      .eq('document_version', documentVersion)

    if (userId) query = query.eq('user_id', userId)
    if (mandalId) query = query.eq('mandal_id', mandalId)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ accepted: false, error: error.message })
    }

    return NextResponse.json({
      accepted: data && data.length > 0,
      consentRecord: data?.[0] || null,
    })
  } catch (err: any) {
    return NextResponse.json({ accepted: false, error: err.message })
  }
}
