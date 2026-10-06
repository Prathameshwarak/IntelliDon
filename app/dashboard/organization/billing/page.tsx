'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'
import { useSubscription } from '@/lib/useSubscription'
import { PLANS } from '@/lib/subscription'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BillingPlansPage() {
  const router = useRouter()
  const { loading: orgLoading, mandalId } = useOrg()
  const sub = useSubscription(mandalId)
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; price_label: string; features: string[] }[]>([])

  useEffect(() => {
    fetch('/api/plans').then(r => r.json()).then(d => { if (d.plans) setPlans(d.plans) }).catch(() => {})
  }, [])

  const planKey = sub.subscription?.plan || ''
  const planMeta = plans.find(p => p.id === planKey) || (planKey && PLANS[planKey] ? { id: planKey, name: PLANS[planKey].name, price: PLANS[planKey].price, price_label: PLANS[planKey].priceLabel, features: PLANS[planKey].features } : null)

  return (
    <OrgShell title="Billing & Plans" subtitle="Current plan, renewal, and payment history">
      {orgLoading || sub.loading ? (
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-mono animate-pulse">Loading subscription...</p>
      ) : !sub.subscription ? (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-[#1A1208]/15 dark:border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium mb-3">No active subscription found.</p>
          <button
            onClick={() => router.push('/dashboard/subscription')}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white cursor-pointer"
          >
            View Plans
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Current plan card */}
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider">Current Plan</p>
                <p className="text-lg font-bold text-[#1A1208] dark:text-white mt-0.5">{planMeta?.name || planKey || 'Unknown'}</p>
                {planMeta?.price_label && <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium mt-0.5">{planMeta.price_label}</p>}
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase
                ${sub.isExpired
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : sub.daysRemaining <= 7
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-green-400'}`}>
                {sub.isExpired ? 'Expired' : sub.subscription.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#1A1208]/10 dark:border-gray-800">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 tracking-wider">Started</p>
                <p className="text-xs font-semibold text-[#1A1208] dark:text-white mt-1">{formatDate(sub.subscription.starts_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 tracking-wider">Renews / Expires</p>
                <p className="text-xs font-semibold text-[#1A1208] dark:text-white mt-1">{formatDate(sub.subscription.ends_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 tracking-wider">Days Remaining</p>
                <p className={`text-xs font-semibold mt-1 ${sub.isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-[#1A1208] dark:text-white'}`}>
                  {sub.isExpired ? 'Expired' : `${sub.daysRemaining} days`}
                </p>
              </div>
            </div>

            {planMeta?.features && planMeta.features.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[#1A1208]/10 dark:border-gray-800">
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 tracking-wider mb-2">Included</p>
                <ul className="flex flex-col gap-1.5">
                  {planMeta.features.map(f => (
                    <li key={f} className="text-xs text-[#4a3f30] dark:text-gray-300 font-medium flex items-center gap-2">
                      <span className="text-[#E8650A]">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="w-full mt-6 px-4 py-2.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
            >
              {sub.isExpired ? 'Renew Plan' : 'Manage / Upgrade Plan'}
            </button>
          </div>

          {/* Payment history */}
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <p className="text-xs font-bold text-[#1A1208] dark:text-white mb-3">Last Payment</p>
            {sub.subscription.last_payment_at || sub.subscription.last_payment_amount ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7a6a55] dark:text-gray-400 font-medium">{formatDate(sub.subscription.last_payment_at)}</span>
                <span className="font-bold text-[#1A1208] dark:text-white">
                  {sub.subscription.last_payment_amount != null ? `₹${sub.subscription.last_payment_amount}` : '—'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No payments recorded yet.</p>
            )}
            {sub.subscription.notes && (
              <p className="text-[11px] text-[#7a6a55] dark:text-gray-500 font-medium mt-3 pt-3 border-t border-[#1A1208]/10 dark:border-gray-800">
                {sub.subscription.notes}
              </p>
            )}
            <p className="text-[11px] text-[#7a6a55] dark:text-gray-500 font-medium mt-3">
              For full billing history and UPI payment submissions, open{' '}
              <button onClick={() => router.push('/dashboard/subscription')} className="underline font-bold text-[#E8650A] dark:text-orange-400 cursor-pointer">
                Billing & Plans →
              </button>
            </p>
          </div>
        </div>
      )}
    </OrgShell>
  )
}
