import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PLANS } from '@/lib/subscription'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id, name, price, price_label, features')
      .order('price', { ascending: true })

    if (error || !data || data.length === 0) {
      // Graceful fallback to static PLANS
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
    console.error('Fetch plans API error, using fallback:', err)
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
