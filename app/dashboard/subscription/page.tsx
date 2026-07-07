'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PLANS, PlanKey, useSubscription, SUPPORT_WHATSAPP_URL } from '@/lib/subscription'

export default function SubscriptionPage() {
  const router = useRouter()
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, mandal_id')
        .eq('id', user.id)
        .single()

      if (!userRow || !['admin', 'manager'].includes(userRow.role)) {
        router.push('/login')
        return
      }

      const { data: mandal } = await supabase
        .from('mandals')
        .select('name')
        .eq('id', userRow.mandal_id)
        .single()

      setMandalId(userRow.mandal_id)
      setMandalName(mandal?.name || '')
      setLoading(false)
    }
    init()
  }, [router])

  const { subscription, loading: subLoading, isExpired, daysRemaining } = useSubscription(mandalId)

  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  const currentPlanKey = (subscription?.plan || 'trial') as PlanKey
  const currentPlan = PLANS[currentPlanKey]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Intellidon</p>
          <p className="text-base font-semibold">{mandalName}</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs text-gray-400 hover:text-white transition-colors">
          ← Back to dashboard
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Current status */}
        <div className={`rounded-2xl p-6 border ${isExpired ? 'bg-red-950/20 border-red-900/40' : 'bg-gray-900 border-gray-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Current Plan</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
              ${isExpired ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
              {isExpired ? 'Expired' : 'Active'}
            </span>
          </div>
          <p className="text-2xl font-bold text-white">{currentPlan.name}</p>
          <p className="text-gray-400 text-sm mt-1">{currentPlan.priceLabel}</p>

          {subscription?.ends_at && (
            <p className="text-xs text-gray-500 mt-3">
              {isExpired
                ? `Expired on ${new Date(subscription.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : `Renews / expires on ${new Date(subscription.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
            </p>
          )}

          {subscription?.notes && (
            <div className="mt-4 bg-gray-950/60 border border-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Note from Intellidon team</p>
              <p className="text-xs text-gray-300">{subscription.notes}</p>
            </div>
          )}

          {isExpired && (
            <div className="mt-4 bg-red-950/30 border border-red-900/30 rounded-lg p-3 text-xs text-red-300">
              Your subscription has expired. You can still receive and record donations, but collection history,
              event management, and team management are locked until you renew.
            </div>
          )}
        </div>

        {/* Plans comparison */}
        <div>
          <p className="text-sm font-semibold text-white mb-3">Available Plans</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(PLANS) as PlanKey[]).map(key => {
              const p = PLANS[key]
              const isCurrent = key === currentPlanKey
              return (
                <div key={key} className={`rounded-xl p-4 border flex flex-col
                  ${isCurrent ? 'border-orange-500 bg-orange-950/10' : 'border-gray-800 bg-gray-900'}`}>
                  <p className="text-white font-semibold text-sm">{p.name}</p>
                  <p className="text-orange-400 font-bold text-lg mt-1">{p.priceLabel}</p>
                  <ul className="text-gray-400 text-xs mt-3 space-y-1.5 flex-1">
                    {p.features.map(f => <li key={f}>• {f}</li>)}
                  </ul>
                  {isCurrent && (
                    <span className="mt-3 text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
                      Current Plan
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Manual renewal instructions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-2">How to renew or upgrade</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Payments are currently handled manually. Contact the Intellidon team on WhatsApp to upgrade your plan
            or renew your subscription. Once payment is confirmed, your plan will be activated within a few hours.
          </p>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            💬 Contact on WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}