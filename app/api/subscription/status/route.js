import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkSubscription } from '@/lib/subscription'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mandal_id = searchParams.get('mandal_id')

    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    const status = await checkSubscription(mandal_id)

    // Fetch full history of subscription attempts
    const { data: history } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('mandal_id', mandal_id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      ...status,
      history: history || []
    })

  } catch (err) {
    console.error('Subscription status fetch error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
