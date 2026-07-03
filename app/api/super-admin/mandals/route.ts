import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use the SERVICE ROLE key to bypass Row Level Security (RLS) on administrative tasks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET all mandals - super admin sees pending + active + suspended
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending' // default: show pending

    const { data: mandals, error } = await supabaseAdmin
      .from('mandals')
      .select(`
        id,
        name,
        slug,
        address,
        city,
        phone,
        status,
        created_at,
        users (
          id,
          full_name,
          phone,
          role
        ),
        subscriptions (
          plan,
          status,
          ends_at
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch mandals error:', error)
      return NextResponse.json({ error: 'Could not fetch mandals' }, { status: 500 })
    }

    return NextResponse.json({ mandals })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// PATCH - approve, reject, or suspend a mandal
// Body: { mandalId: string, action: 'approve' | 'reject' | 'suspend', plan?: string }
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { mandalId, action, plan = 'trial' } = body

    if (!mandalId || !action) {
      return NextResponse.json({ error: 'mandalId and action are required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'active' : action === 'suspend' ? 'suspended' : 'pending'

    // Update mandal status
    const { error: updateError } = await supabaseAdmin
      .from('mandals')
      .update({ status: newStatus })
      .eq('id', mandalId)

    if (updateError) {
      console.error('Update mandal error:', updateError)
      return NextResponse.json({ error: 'Could not update mandal' }, { status: 500 })
    }

    // If approving - create a subscription row for them if it doesn't already exist
    if (action === 'approve') {
      const trialDays = 30
      const endsAt = new Date()
      endsAt.setDate(endsAt.getDate() + trialDays)

      // Check if subscription already exists (don't double-create)
      const { data: existing, error: findSubError } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('mandal_id', mandalId)
        .maybeSingle()

      if (findSubError) {
        console.error('Error checking existing subscription:', findSubError)
      }

      if (!existing) {
        const { error: subError } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            mandal_id: mandalId,
            plan: plan,
            status: 'active',
            ends_at: endsAt.toISOString()
          })

        if (subError) {
          console.error('Subscription create error:', subError)
          // Don't fail the whole request - mandal is approved, subscription can be fixed manually
        }
      }
    }

    const formattedAction = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended'

    return NextResponse.json({
      success: true,
      message: `Mandal ${formattedAction} successfully`,
      newStatus
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
