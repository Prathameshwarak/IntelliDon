import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET — a mandal's own subscription status (admin or manager, must belong to the mandal)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mandal_id = searchParams.get('mandal_id')
    if (!mandal_id) {
      return NextResponse.json({ error: 'mandal_id is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('mandal_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.mandal_id !== mandal_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status, starts_at, ends_at, notes, amount, last_payment_at, last_payment_amount')
      .eq('mandal_id', mandal_id)
      .maybeSingle()

    if (error) {
      console.error('Fetch subscription error:', error)
      return NextResponse.json({ error: 'Could not fetch subscription' }, { status: 500 })
    }

    return NextResponse.json({ subscription })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}