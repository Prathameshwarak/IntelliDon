export type PlanKey = string

export const PLANS: Record<string, { name: string; price: number; priceLabel: string; features: string[] }> = {
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
  starts_at?: string | null
  amount?: number | null
  last_payment_at?: string | null
  last_payment_amount?: number | null
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