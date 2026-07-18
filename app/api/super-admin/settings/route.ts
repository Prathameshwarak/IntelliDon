import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

export async function GET(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')

    if (error) {
      console.warn('System settings fetch warning (table may not exist yet):', error.message)
      // Return default values if table does not exist
      return NextResponse.json({ settings: [{ key: 'subscription_upi_id', value: 'intellidon@upi' }] })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error('Unexpected error fetching settings:', err)
    return NextResponse.json({ settings: [{ key: 'subscription_upi_id', value: 'intellidon@upi' }] })
  }
}

export async function PATCH(request: Request) {
  const authCheck = await verifySuperAdmin(request)
  if ('error' in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (error) {
      console.error('Update system setting error:', error)
      return NextResponse.json({ error: 'Could not save setting. Make sure the system_settings table exists in database.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, setting: data })
  } catch (err) {
    console.error('Unexpected error updating setting:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
