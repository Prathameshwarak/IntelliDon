'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS, SUPPORT_WHATSAPP_URL } from '@/lib/subscription'

type PlanRow = {
  id: string
  name: string
  price: number
  price_label: string
  features: string[]
}

export default function UpgradeBanner({ onContinue }: { onContinue: () => void }) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(5)
  const [plans, setPlans] = useState<PlanRow[]>([])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/plans')
        const data = await res.json()
        if (data.plans) {
          setPlans(data.plans)
        }
      } catch (err) {
        console.error('Failed to fetch plans for UpgradeBanner:', err)
      }
    }
    fetchPlans()
  }, [])

  // Resolve display plans, falling back to static PLANS if dynamic fetch hasn't completed
  const displayPlans = plans.filter(p => p.price > 0)
  const activePlans = displayPlans.length > 0 
    ? displayPlans 
    : Object.entries(PLANS)
        .filter(([_, p]) => p.price > 0)
        .map(([id, p]) => ({
          id,
          name: p.name,
          price: p.price,
          price_label: p.priceLabel,
          features: p.features,
        }))

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-orange-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-orange-500 px-6 py-4 text-center">
          <p className="text-white font-bold text-base">Subscription Expired</p>
          <p className="text-white/80 text-xs mt-1">Upgrade to remove this and unlock all features</p>
        </div>

        {/* Blocked features */}
        <div className="px-6 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Currently blocked</p>
          <div className="grid grid-cols-2 gap-1.5">
            {['Collection history', 'Event management', 'Team management', 'CSV export'].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="text-red-400 font-bold">✕</span>{f}
              </div>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          {activePlans.map(p => {
            const isPopular = p.id === 'standard'
            return (
              <div key={p.id}
                className={`rounded-xl p-3 border flex flex-col justify-between ${isPopular
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800'}`}>
                <div>
                  {isPopular && (
                    <p className="text-[10px] text-orange-400 font-semibold mb-1 uppercase tracking-wider">Most popular</p>
                  )}
                  <p className="text-white font-semibold text-sm capitalize">{p.name}</p>
                  <p className={`text-sm font-bold mb-2 ${isPopular ? 'text-orange-400' : 'text-white'}`}>
                    {p.price_label}
                  </p>
                  {p.features && p.features.slice(0, 3).map(f => (
                    <div key={f} className="flex items-start gap-1.5 text-[10px] text-gray-400 mt-1">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                      <span className="line-clamp-2">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {/* WhatsApp upgrade CTA */}
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600
              text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            <span>💬</span>
            <span>Upgrade Now — Contact on WhatsApp</span>
          </a>

          {/* View full subscription page */}
          <button
            onClick={() => router.push('/dashboard/subscription')}
            className="w-full border border-gray-700 hover:border-gray-500 text-gray-400
              hover:text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            View plans & details
          </button>

          {/* Dismiss with countdown */}
          <button
            onClick={secondsLeft <= 0 ? onContinue : undefined}
            disabled={secondsLeft > 0}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
              ${secondsLeft <= 0
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 cursor-pointer'
                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'}`}
          >
            {secondsLeft > 0
              ? `Continue to verify (${secondsLeft}s)`
              : 'Close Banner'}
          </button>
        </div>
      </div>
    </div>
  )
}