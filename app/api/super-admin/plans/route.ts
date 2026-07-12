import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PLANS } from '@/lib/subscription'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifySuperAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 }
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid token', status: 401 }
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || !profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden: Super admin access only', status: 403 }
  }
  return { callerId: user.id }
}

// GET all plans
export async function GET(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name, price, price_label, features, created_at')
      .order('price', { ascending: true })

    if (error || !data || data.length === 0) {
      // Fallback
      const fallbackPlans = Object.entries(PLANS).map(([id, p]) => ({
        id,
        name: p.name,
        price: p.price,
        price_label: p.priceLabel,
        features: p.features,
      }))
      return NextResponse.json({ plans: fallbackPlans })
    }

    return NextResponse.json({ plans: data })
  } catch (err) {
    console.error('Super admin plans fetch error:', err)
    const fallbackPlans = Object.entries(PLANS).map(([id, p]) => ({
      id,
      name: p.name,
      price: p.price,
      price_label: p.priceLabel,
      features: p.features,
    }))
    return NextResponse.json({ plans: fallbackPlans })
  }
}

// POST — Create a plan
export async function POST(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { id, name, price, price_label, features } = body

    if (!id || !name || price === undefined || !price_label) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        id: id.toLowerCase().trim(),
        name: name.trim(),
        price: parseFloat(price),
        price_label: price_label.trim(),
        features: features || [],
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Create plan error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: data })
  } catch (err) {
    console.error('Unexpected post plan error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PUT — Update a plan
export async function PUT(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { id, name, price, price_label, features } = body

    if (!id || !name || price === undefined || !price_label) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .update({
        name: name.trim(),
        price: parseFloat(price),
        price_label: price_label.trim(),
        features: features || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update plan error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: data })
  } catch (err) {
    console.error('Unexpected put plan error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — Delete a plan
export async function DELETE(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Plan id is required' }, { status: 400 })
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
    console.error('Unexpected delete plan error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
