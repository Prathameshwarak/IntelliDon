import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// PATCH — verify a donation (admin/manager only)
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { donation_id, verified_by } = body

    if (!donation_id || !verified_by) {
      return NextResponse.json({ error: 'donation_id and verified_by are required' }, { status: 400 })
    }

    // Confirm the verifier is admin or manager
    const { data: verifier } = await supabaseAdmin
      .from('users')
      .select('role, mandal_id')
      .eq('id', verified_by)
      .single()

    if (!verifier || !['admin', 'manager'].includes(verifier.role)) {
      return NextResponse.json({ error: 'Only admin or manager can verify donations' }, { status: 403 })
    }

    // Confirm donation belongs to the same mandal
    const { data: donation } = await supabaseAdmin
      .from('donations')
      .select('id, mandal_id, status')
      .eq('id', donation_id)
      .single()

    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    if (donation.mandal_id !== verifier.mandal_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (donation.status === 'verified') {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('donations')
      .update({
        status: 'verified',
        verified_by,
        verified_at: new Date().toISOString()
      })
      .eq('id', donation_id)

    if (error) return NextResponse.json({ error: 'Could not verify donation' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
