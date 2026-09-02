import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { PLANS } from '@/lib/subscription'
import { getOrSetCache } from '@/lib/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const plans = await getOrSetCache('subscription_plans', async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, price_label, features')
        .order('price', { ascending: true })

      if (error || !data || data.length === 0) {
        return Object.entries(PLANS).map(([id, p]) => ({
          id,
          name: p.name,
          price: p.price,
          price_label: p.priceLabel,
          features: p.features,
        }))
      }

      return data
    }, 600) // 10 minutes cache

    return NextResponse.json({ plans }, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600' }
    })
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
