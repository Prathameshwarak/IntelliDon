import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')

    if (error) {
      console.warn('System settings fetch warning:', error.message)
      return NextResponse.json({ settings: [{ key: 'subscription_upi_id', value: 'intellidon@upi' }] })
    }

    return NextResponse.json({ settings: data })
  } catch (err) {
    console.error('Unexpected error fetching settings:', err)
    return NextResponse.json({ settings: [{ key: 'subscription_upi_id', value: 'intellidon@upi' }] })
  }
}
