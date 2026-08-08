import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildReceiptData } from '@/lib/receiptData'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting in-memory store
interface SearchLimitRecord {
  timestamps: number[]
}
const rateLimitMap = new Map<string, SearchLimitRecord>()
const MAX_SEARCHES = 20 // Max 20 searches per 5 minutes per IP
const WINDOW_MS = 5 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const record = rateLimitMap.get(ip) || { timestamps: [] }
  const valid = record.timestamps.filter((t) => t > cutoff)
  if (valid.length >= MAX_SEARCHES) {
    return false
  }
  valid.push(now)
  rateLimitMap.set(ip, { timestamps: valid })
  return true
}

/**
 * Sanitize query input to prevent PostgREST syntax injection (commas, parentheses, colons, dots)
 */
function sanitizeInput(str: string): string {
  return str.replace(/[,().:\\'"%_\\]/g, '').trim()
}

export async function GET(request: Request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown-ip'

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many search requests. Please wait 5 minutes before trying again.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get('q')?.trim() || ''
    const rawSlug = searchParams.get('slug')?.trim() || ''
    const rawMandalId = searchParams.get('mandal_id')?.trim() || ''

    const sanitizedQuery = sanitizeInput(rawQuery)
    const sanitizedSlug = sanitizeInput(rawSlug)
    const sanitizedMandalId = sanitizeInput(rawMandalId)

    // Enforce minimum query length of 4 characters to prevent mass enumeration attacks
    if (!sanitizedQuery || sanitizedQuery.length < 4) {
      return NextResponse.json(
        { error: 'Please enter a valid 4-digit code, receipt number, or 10-digit mobile number' },
        { status: 400 }
      )
    }

    const upperQuery = sanitizedQuery.toUpperCase()
    const cleanPhone = sanitizedQuery.replace(/\D/g, '')

    let mandalIdToFilter = sanitizedMandalId

    // If slug provided, resolve mandal_id safely
    if (sanitizedSlug && !mandalIdToFilter) {
      const { data: mandalRow } = await supabaseAdmin
        .from('mandals')
        .select('id')
        .eq('slug', sanitizedSlug)
        .maybeSingle()
      if (mandalRow) {
        mandalIdToFilter = mandalRow.id
      }
    }

    // Base database query
    let dbQuery = supabaseAdmin
      .from('donations')
      .select(`
        id,
        receipt_number,
        donor_name,
        donor_phone,
        donor_address,
        amount,
        payment_mode,
        status,
        screenshot_url,
        receipt_data,
        created_at,
        verified_at,
        verification_type,
        collected_by,
        mandal_id,
        mandals (
          id,
          name,
          address,
          city,
          phone,
          doc_logo,
          admin_email,
          slug
        ),
        events (
          id,
          name,
          year
        ),
        users!collected_by (
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10) // Limit response size to prevent data dumping

    if (mandalIdToFilter) {
      dbQuery = dbQuery.eq('mandal_id', mandalIdToFilter)
    }

    const orConditions: string[] = []

    // 1. If exact 10-digit mobile number, query phone strictly
    if (cleanPhone.length === 10) {
      orConditions.push(`donor_phone.eq.${cleanPhone}`)
    }

    // 2. Exact 4-character code match for JSONB fields and receipt_number
    if (upperQuery.length === 4) {
      orConditions.push(`receipt_data->>receiptCode.eq.${upperQuery}`)
      orConditions.push(`receipt_data->>receipt_code.eq.${upperQuery}`)
      orConditions.push(`receipt_number.ilike.%${upperQuery}%`)
    } else {
      // 3. Receipt number queries (e.g. REC-1002)
      orConditions.push(`receipt_number.ilike.%${upperQuery}%`)
      orConditions.push(`receipt_data->>receiptNumber.ilike.%${upperQuery}%`)
    }

    if (orConditions.length === 0) {
      return NextResponse.json({ success: true, count: 0, receipts: [] })
    }

    dbQuery = dbQuery.or(orConditions.join(','))

    const { data: donations, error } = await dbQuery

    if (error) {
      console.error('Download search error:', error)
      return NextResponse.json({ error: 'Failed to query receipts' }, { status: 500 })
    }

    if (!donations || donations.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        receipts: []
      })
    }

    // Process each matching donation safely
    const formattedReceipts = await Promise.all(
      donations.map(async (row: any) => {
        const mandal = row.mandals
        const event = row.events
        const collector = row.users

        let logoUrl: string | null = null
        if (mandal?.doc_logo) {
          try {
            const { data: signedLogo } = await supabaseAdmin.storage
              .from('kyc-documents')
              .createSignedUrl(mandal.doc_logo, 60 * 60 * 24 * 365)
            logoUrl = signedLogo?.signedUrl || null
          } catch (e) {
            console.warn('Signed logo URL error:', e)
          }
        }

        let screenshotUrl: string | null = null
        if (row.screenshot_url) {
          if (row.screenshot_url.startsWith('http')) {
            screenshotUrl = row.screenshot_url
          } else {
            try {
              const { data: signedScreenshot } = await supabaseAdmin.storage
                .from('payment-screenshots')
                .createSignedUrl(row.screenshot_url, 60 * 60 * 24)
              screenshotUrl = signedScreenshot?.signedUrl || null
            } catch (e) {
              console.warn('Signed screenshot URL error:', e)
            }
          }
        }

        let receiptData = row.receipt_data

        if (!receiptData) {
          receiptData = buildReceiptData({
            donation: row,
            mandal,
            event,
            collectorName: collector?.full_name || null,
            logoUrl
          })
          receiptData.verified = row.status === 'verified'
        } else {
          receiptData = {
            ...receiptData,
            mandalLogo: logoUrl || receiptData.mandalLogo || null,
            screenshotUrl: screenshotUrl || receiptData.screenshotUrl || null,
            verified: row.status === 'verified'
          }
        }

        return {
          id: row.id,
          receipt_number: row.receipt_number,
          receipt_code: receiptData.receiptCode || null,
          donor_name: row.donor_name,
          donor_phone: row.donor_phone,
          amount: row.amount,
          status: row.status,
          created_at: row.created_at,
          mandal_name: mandal?.name || 'Organisation',
          event_name: event ? `${event.name} ${event.year}` : '',
          screenshot_url: screenshotUrl,
          receipt_data: receiptData
        }
      })
    )

    return NextResponse.json({
      success: true,
      count: formattedReceipts.length,
      receipts: formattedReceipts
    })
  } catch (err) {
    console.error('Unexpected error in download search:', err)
    return NextResponse.json({ error: 'Something went wrong searching for receipts' }, { status: 500 })
  }
}
