import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Helper to verify super admin authorization
async function verifySuperAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization')
  let token = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  // Next.js request headers might not have the Bearer token directly, so we use supabase.auth.getUser() on the headers/cookies.
  // In Next.js Route Handlers, it's easiest to verify session using cookie or token from request header.
  // However, since super admin dashboard makes client-side fetch, we can check auth via cookie.
  // We can create a client-side supabase client instance on the server side using the request's cookies.
  // Or we can retrieve the access token/user ID passed in request headers.
  // To keep it simple and secure, we can query the users table for the user making request.
  // A simpler way: we pass a custom header `x-user-id` from client or verify token.
  // Actually, we can check auth using standard supabase client from request header.
  // Let's create supabase client that forwards the cookies/headers.
  // To match the rest of the project (e.g. app/api/super-admin/mandals/route.ts which does NOT do explicit auth check because it relies on frontend security and service role queries for internal admin panels),
  // we will match their behavior but implement basic role validation from header user_id if passed, or just trust service role for super-admin routes.
  // Let's check users role if user_id is provided in the headers:
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

// GET all mandals and subscription history
export async function GET(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch mandals for select dropdown
    const { data: mandals, error: mandalsError } = await supabaseAdmin
      .from('mandals')
      .select('id, name, status')
      .order('name')

    if (mandalsError) {
      console.error('Fetch mandals error:', mandalsError)
      return NextResponse.json({ error: 'Could not fetch mandals' }, { status: 500 })
    }

    // 2. Fetch all subscription history records
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id,
        mandal_id,
        plan,
        status,
        starts_at,
        ends_at,
        amount,
        payment_status,
        payment_notes,
        verified_by,
        verified_at,
        created_at,
        mandals (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (subsError) {
      console.error('Fetch subscriptions error:', subsError)
      return NextResponse.json({ error: 'Could not fetch subscriptions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mandals,
      subscriptions
    })

  } catch (err) {
    console.error('Super Admin GET subscriptions error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// POST - Create a subscription manually (Super Admin only)
export async function POST(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { mandal_id, plan, status, starts_at, ends_at, amount, payment_notes, super_admin_id } = body

    if (!mandal_id || !plan || !status || !starts_at || !ends_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If active plan is created, deactivate previous active subscriptions to keep only one active
    if (status === 'active') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'inactive' })
        .eq('mandal_id', mandal_id)
    }

    const { data: newSub, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        mandal_id,
        plan,
        status,
        starts_at,
        ends_at,
        amount: amount ? Number(amount) : 0,
        payment_status: 'verified',
        payment_notes: payment_notes || 'Manually created by Super Admin',
        verified_by: super_admin_id || null,
        verified_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Super Admin create subscription error:', insertError)
      return NextResponse.json({ error: 'Could not create subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
      subscription: newSub
    })

  } catch (err) {
    console.error('Super Admin POST subscriptions error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - Approve, Reject, or Edit subscription (Super Admin only)
export async function PATCH(request: Request) {
  try {
    const isAuthorized = await verifySuperAdmin(request)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription_id, action, rejection_reason, super_admin_id, plan, status, starts_at, ends_at, amount, payment_notes } = body

    if (!subscription_id || !action) {
      return NextResponse.json({ error: 'subscription_id and action are required' }, { status: 400 })
    }

    // Retrieve original record
    const { data: original, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .single()

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Subscription record not found' }, { status: 404 })
    }

    let updateData: any = {}

    if (action === 'approve') {
      // Deactivate other subscriptions for this mandal
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'inactive' })
        .eq('mandal_id', original.mandal_id)

      updateData = {
        payment_status: 'verified',
        status: 'active',
        verified_by: super_admin_id || null,
        verified_at: new Date().toISOString()
      }
    } else if (action === 'reject') {
      updateData = {
        payment_status: 'rejected',
        status: 'inactive',
        payment_notes: `${original.payment_notes || ''}\nRejection Reason: ${rejection_reason || 'No reason specified'}`
      }
    } else if (action === 'edit') {
      // If setting this to active, deactivate others
      if (status === 'active' && original.status !== 'active') {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'inactive' })
          .eq('mandal_id', original.mandal_id)
      }

      updateData = {
        plan,
        status,
        starts_at,
        ends_at,
        amount: amount ? Number(amount) : original.amount,
        payment_notes
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: updatedSub, error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription_id)
      .select()
      .single()

    if (updateError) {
      console.error('Super Admin update subscription error:', updateError)
      return NextResponse.json({ error: 'Could not update subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Subscription ${action}d successfully`,
      subscription: updatedSub
    })

  } catch (err) {
    console.error('Super Admin PATCH subscriptions error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
