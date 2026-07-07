import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type PlanKey = 'trial' | 'basic' | 'standard'

export const PLANS: Record<PlanKey, { name: string; price: number; priceLabel: string; features: string[] }> = {
  trial: {
    name: 'Trial',
    price: 0,
    priceLabel: 'Free — 30 days',
    features: ['All features unlocked', 'Team management', 'Event management'],
  },
  basic: {
    name: 'Basic',
    price: 299,
    priceLabel: '₹299 / month',
    features: ['Everything in Trial', 'Collection history', 'Unlimited team members'],
  },
  standard: {
    name: 'Standard',
    price: 599,
    priceLabel: '₹599 / month',
    features: ['Everything in Basic', 'CSV / report export', 'Priority support'],
  },
}

export const SUPPORT_WHATSAPP_URL = 'https://wa.me/919999999999?text=Hello%20Intellidon%20Support'

export type SubscriptionInfo = {
  plan: PlanKey
  status: 'active' | 'suspended'
  ends_at: string | null
  notes: string | null
}

export function isSubscriptionExpired(sub: SubscriptionInfo | null): boolean {
  if (!sub) return true
  if (sub.status === 'suspended') return true
  if (!sub.ends_at) return true
  return new Date(sub.ends_at).getTime() < Date.now()
}

export function daysRemaining(sub: SubscriptionInfo | null): number {
  if (!sub || !sub.ends_at) return 0
  const diff = new Date(sub.ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// Shared hook — used on the dashboard, the /dashboard/subscription page,
// and to gate the verify flow when a subscription has lapsed.
export function useSubscription(mandalId: string | null) {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)

  const fetchSubscription = useCallback(async () => {
    if (!mandalId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/subscription?mandal_id=${mandalId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!data.error) setSubscription(data.subscription)
    } catch (err) {
      console.error('Failed to fetch subscription', err)
    } finally {
      setLoading(false)
    }
  }, [mandalId])

  useEffect(() => { fetchSubscription() }, [fetchSubscription])

  return {
    loading,
    subscription,
    isExpired: isSubscriptionExpired(subscription),
    daysRemaining: daysRemaining(subscription),
    refetch: fetchSubscription,
  }
}