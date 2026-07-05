import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { mandal_id, plan, amount, payment_notes, screenshot_url } = body

    if (!mandal_id || !plan || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // 1. Fetch latest subscription for this mandal to determine starts_at
    const { data: latestSub, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('ends_at, status')
      .eq('mandal_id', mandal_id)
      .eq('status', 'active')
      .order('ends_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let startsAt = new Date()
    if (latestSub) {
      const endsAt = new Date(latestSub.ends_at)
      // If the latest active subscription is in the future, start this after it ends
      if (endsAt.getTime() > startsAt.getTime()) {
        startsAt = endsAt
      }
    }

    // Calculate ends_at
    let endsAt = new Date(startsAt)
    if (plan === 'monthly') {
      endsAt.setDate(endsAt.getDate() + 30)
    } else if (plan === 'yearly') {
      endsAt.setDate(endsAt.getDate() + 365)
    }

    // Combine notes and screenshot URL to store in payment_notes column
    let combinedNotes = payment_notes || ''
    if (screenshot_url) {
      combinedNotes = `Screenshot: ${screenshot_url}\nNotes: ${combinedNotes}`
    }

    // 2. Insert subscription with status = 'inactive' and payment_status = 'pending'
    const { data: newSub, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        mandal_id,
        plan,
        status: 'inactive', // inactive until verified by super admin
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        amount: Number(amount),
        payment_status: 'pending',
        payment_notes: combinedNotes
      })
      .select()
      .single()

    if (insertError) {
      console.error('Subscription renewal insertion error:', insertError)
      return NextResponse.json({ error: 'Could not submit renewal request' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      subscription: newSub
    })

  } catch (err) {
    console.error('Subscription renewal unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
