import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const FALLBACK_PLANS = [
  {
    id: 'monthly-premium',
    name: 'Premium Monthly',
    code: 'monthly',
    price: 399,
    duration_days: 30,
    features: ['events', 'donations', 'team', 'history', 'reports'],
    description: 'Unlimited event collections & tracking'
  },
  {
    id: 'yearly-premium',
    name: 'Premium Yearly',
    code: 'yearly',
    price: 3999,
    duration_days: 365,
    features: ['events', 'donations', 'team', 'history', 'reports'],
    description: 'Unlimited event collections & tracking + Priority Support'
  }
]

// Auth check helper
async function verifySuperAdmin(request: Request) {
  const userId = request.headers.get('x-user-id')
  if (userId) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (!userRow || userRow.role !== 'super_admin') {
      return false
    }
  }
  return true
}

export async function GET(request: Request) {
  try {
    const { data: dbPlans, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true })

    if (error) {
      // Table doesn't exist yet, return fallbacks
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ success: true, plans: FALLBACK_PLANS, isFallback: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, plans: dbPlans || [], isFallback: false })
  } catch (err) {
    console.error('Fetch plans error:', err)
    return NextResponse.json({ success: true, plans: FALLBACK_PLANS, isFallback: true })
  }
}

export async function POST(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, price, duration_days, features, description } = body

    if (!name || !code || price === undefined || !duration_days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: newPlan, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        name: name.trim(),
        code: code.trim().toLowerCase(),
        price: Number(price),
        duration_days: Number(duration_days),
        features: Array.isArray(features) ? features : [],
        description: description || ''
      })
      .select()
      .single()

    if (error) {
      console.error('Create plan error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: newPlan })
  } catch (err) {
    console.error('POST plan unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, code, price, duration_days, features, description } = body

    if (!id || !name || !code || price === undefined || !duration_days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: updatedPlan, error } = await supabaseAdmin
      .from('subscription_plans')
      .update({
        name: name.trim(),
        code: code.trim().toLowerCase(),
        price: Number(price),
        duration_days: Number(duration_days),
        features: Array.isArray(features) ? features : [],
        description: description || ''
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update plan error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: updatedPlan })
  } catch (err) {
    console.error('PUT plan unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete plan error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE plan unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
