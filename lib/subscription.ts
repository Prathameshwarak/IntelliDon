import { supabase } from './supabase'

// Using supabaseAdmin-like client or the default supabase client.
// Since server-side calls might use a service role client to bypass RLS, 
// let's create a helper that uses supabaseAdmin or default supabase.
// In Next.js App Router, we want to query subscriptions.
// Since subscriptions table might have RLS, it's safer to query it using supabaseAdmin if we are on the server side,
// or via the service role key.
// Let's import createClient from supabase-js and use env variables to create a service role client for subscription checks.
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export type SubscriptionStatus = {
  active: boolean
  plan: string
  status: string
  startsAt: string | null
  endsAt: string | null
  daysRemaining: number
  expired: boolean
  paymentStatus: string | null
}

/**
 * Checks the subscription status for a given mandal.
 * Returns detailed status information.
 */
export async function checkSubscription(mandalId: string): Promise<SubscriptionStatus> {
  const defaultStatus: SubscriptionStatus = {
    active: false,
    plan: 'none',
    status: 'inactive',
    startsAt: null,
    endsAt: null,
    daysRemaining: 0,
    expired: true,
    paymentStatus: null
  }

  if (!mandalId) return defaultStatus

  try {
    // Fetch the latest subscription record for this mandal
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('mandal_id', mandalId)
      .order('ends_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return defaultStatus
    }

    const now = new Date()
    const endsAt = new Date(data.ends_at)
    const startsAt = new Date(data.starts_at)

    const isStatusActive = data.status === 'active'
    const isNotExpired = endsAt.getTime() >= now.getTime()
    const active = isStatusActive && isNotExpired

    const diffTime = endsAt.getTime() - now.getTime()
    const daysRemaining = isNotExpired ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0

    return {
      active,
      plan: data.plan || 'none',
      status: data.status || 'inactive',
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      daysRemaining,
      expired: !active,
      paymentStatus: data.payment_status || null
    }
  } catch (err) {
    console.error('Error checking subscription:', err)
    return defaultStatus
  }
}

/**
 * Guard check to see if a mandal can use a specific feature.
 */
export async function canUseFeature(mandalId: string, feature: string): Promise<boolean> {
  const sub = await checkSubscription(mandalId)
  if (!sub.active) return false

  // All active plans (trial, monthly, yearly) have access to all features.
  // In the future, specific limits can be added here.
  const planPermissions: Record<string, string[]> = {
    trial: ['events', 'donations', 'team', 'history', 'reports'],
    monthly: ['events', 'donations', 'team', 'history', 'reports'],
    yearly: ['events', 'donations', 'team', 'history', 'reports']
  }

  const allowedFeatures = planPermissions[sub.plan] || []
  return allowedFeatures.includes(feature)
}
