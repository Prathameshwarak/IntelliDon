'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { type SubscriptionInfo, isSubscriptionExpired, daysRemaining } from './subscription'

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
