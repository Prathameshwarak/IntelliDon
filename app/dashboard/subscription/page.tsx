'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscription } from '@/lib/useSubscription'
import UpiQR from '@/components/UpiQR'

type PlanRow = {
  id: string
  name: string
  price: number
  price_label: string
  features: string[]
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardSubscriptionPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [adminName, setAdminName] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null)

  // Subscription hook for normal admin
  const sub = useSubscription(mandalId)

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, mandal_id')
        .eq('id', user.id)
        .single()

      if (!userRow || !['super_admin', 'admin', 'manager'].includes(userRow.role)) {
        router.push('/')
        return
      }

      if (userRow.role === 'super_admin') {
        router.push('/super-admin/subscriptions')
        return
      }

      setMandalId(userRow.mandal_id)

      if (userRow.mandal_id) {
        const { data: mandal } = await supabase
          .from('mandals')
          .select('name, admin_full_name, admin_phone, admin_email')
          .eq('id', userRow.mandal_id)
          .single()
        setMandalName(mandal?.name || '')
        setAdminName(mandal?.admin_full_name || '')
        setAdminPhone(mandal?.admin_phone || '')
        setAdminEmail(mandal?.admin_email || '')
      }

      setAuthorized(true)
    }
    checkAccess()
  }, [router])

  const [subUpiId, setSubUpiId] = useState('intellidon@upi')

  // ── Fetch plans and settings ──────────────────────────────────
  useEffect(() => {
    async function fetchPlansAndSettings() {
      try {
        const res = await fetch('/api/plans')
        const data = await res.json()
        if (data.plans) {
          setPlans(data.plans)
        }
      } catch (err) {
        console.error('Failed to fetch plans:', err)
      }

      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        if (data.settings) {
          const upi = data.settings.find((s: any) => s.key === 'subscription_upi_id')?.value
          if (upi) setSubUpiId(upi)
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      }
    }
    fetchPlansAndSettings()
  }, [])

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Checking access...</p>
      </div>
    )
  }

  if (sub.loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading subscription details...</p>
      </div>
    )
  }

  const getWhatsAppUrl = () => {
    const baseNumber = '919999999999'
    const message = `Hello Intellidon Support, I would like to inquire about upgrading/renewing the subscription for Mandal: ${mandalName} (ID: ${mandalId}).`
    return `https://wa.me/${baseNumber}?text=${encodeURIComponent(message)}`
  }

  // Only display paid plans for upgrade
  const displayPlans = plans.filter(p => p.price > 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors mb-6 group">
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                Subscription Plan
              </h1>
              {mandalName && (
                <span className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-1 rounded-full font-medium mt-1">
                  {mandalName}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1">View your mandal's active subscription and plans</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Column 1: Current Status */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
              {/* Subtle gradient background glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-4">
                Current Status
              </h2>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-gray-400">Plan</p>
                  <p className="text-xl font-bold text-white mt-1 capitalize font-sans">
                    {sub.subscription?.plan || 'No Active Plan'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${sub.isExpired ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                    <span className={`text-sm font-semibold capitalize ${sub.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                      {sub.isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Validity</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {sub.subscription?.ends_at 
                      ? `${fmtDate(sub.subscription.ends_at)} (${sub.daysRemaining} days remaining)`
                      : 'N/A'}
                  </p>
                </div>

                {sub.subscription?.notes && (
                  <div className="border-t border-gray-800 pt-3">
                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                    <p className="text-xs text-gray-300 italic whitespace-pre-line bg-gray-950/40 p-2.5 rounded-lg border border-gray-800/50">
                      {sub.subscription.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Available Plans */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2">Available Subscription Plans</h2>
              <p className="text-xs text-gray-400 mb-6">Select a plan to upgrade or renew. Contact support to finalize payment.</p>

              {displayPlans.length === 0 ? (
                <p className="text-sm text-gray-500 italic py-6">No upgrade plans currently configured.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayPlans.map(p => {
                    const isPopular = p.id === 'standard'
                    const isCurrent = sub.subscription?.plan === p.id

                    const isSelected = selectedPlan?.id === p.id

                    return (
                      <div 
                        key={p.id} 
                        onClick={() => setSelectedPlan(p)}
                        className={`rounded-2xl p-5 border relative flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] cursor-pointer
                          ${isSelected
                            ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30 shadow-orange-500/10 shadow-lg'
                            : isCurrent 
                              ? 'border-green-500/50 bg-green-950/10 shadow-green-950/20' 
                              : isPopular 
                                ? 'border-orange-500/40 bg-orange-500/5 shadow-orange-950/10 shadow-md' 
                                : 'border-gray-800 bg-gray-950 hover:border-gray-750'}`}
                      >
                        {isCurrent && (
                          <span className="absolute top-3 right-3 text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-green-500/30">
                            Current Plan
                          </span>
                        )}
                        {!isCurrent && isPopular && (
                          <span className="absolute top-3 right-3 text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-orange-500/30">
                            Popular
                          </span>
                        )}

                        <div>
                          <p className="text-white font-bold text-sm capitalize">{p.name}</p>
                          <p className={`text-base font-extrabold mt-1.5 ${isCurrent ? 'text-green-400' : isPopular ? 'text-orange-400' : 'text-white'}`}>
                            {p.price_label}
                          </p>

                          {p.features && p.features.length > 0 && (
                            <ul className="mt-5 space-y-2.5">
                              {p.features.map(f => (
                                <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                                  <span className="text-green-400 font-bold flex-shrink-0 mt-0.5">✓</span>
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Subscription Payment Details Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white">How to Upgrade or Renew</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Follow the steps below to make subscription payment and activate your plan.
                </p>
              </div>

              {!selectedPlan ? (
                <div className="bg-gray-950/40 border border-dashed border-gray-805 rounded-xl p-8 text-center">
                  <p className="text-xs text-gray-500">Please click and select one of the available subscription plans above to proceed with the payment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  <div className="bg-gray-950 border border-gray-850 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] bg-orange-500/10 text-orange-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Step 1: UPI Payment
                      </span>
                      
                      {/* Mobile View: Proceed Button */}
                      <div className="block md:hidden mt-3 space-y-3">
                        <p className="text-xs text-gray-300">
                          Click the button below to open your UPI app and pay for the <strong>{selectedPlan.name}</strong> plan.
                        </p>
                        <a 
                          href={`upi://pay?pa=${encodeURIComponent(subUpiId)}&pn=${encodeURIComponent('Intellidon Subscription')}&am=${selectedPlan.price.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
                            `Plan: ${selectedPlan.name}, Price: Rs. ${selectedPlan.price}`
                          )}`}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl shadow transition-all duration-300 flex items-center justify-center gap-2 text-xs cursor-pointer text-center"
                        >
                          <span>⚡</span>
                          <span>Proceed for Payment (Pay ₹{selectedPlan.price})</span>
                        </a>
                      </div>

                      {/* Desktop View: QR Code & UPI ID only */}
                      <div className="hidden md:flex flex-col items-center gap-4 mt-3">
                        <p className="text-xs text-gray-300 text-center">
                          Scan the QR code below or use the UPI ID to pay for the <strong>{selectedPlan.name}</strong> plan.
                        </p>
                        
                        <div className="p-1.5 bg-white rounded-lg">
                          <UpiQR 
                            upiId={subUpiId}
                            name="Intellidon Subscription"
                            amount={selectedPlan.price}
                            note={`Plan: ${selectedPlan.name}, Price: Rs. ${selectedPlan.price}`}
                            size={160}
                          />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-805 w-full">
                          <span className="text-[11px] text-orange-400 font-mono select-all font-bold flex-1 text-center truncate">
                            {subUpiId}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(subUpiId)
                              alert('UPI ID copied to clipboard!')
                            }}
                            className="text-[10px] bg-gray-800 hover:bg-gray-750 text-gray-350 px-2 py-1 rounded transition-colors cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-950 border border-gray-850 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] bg-green-500/10 text-green-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Step 2: Submit Proof
                      </span>
                      <p className="text-xs text-gray-300 mt-2">
                        After making the payment, send the screenshot on WhatsApp to get instant activation.
                      </p>
                    </div>
                    <a 
                      href={getWhatsAppUrl()}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full bg-gray-800 hover:bg-gray-750 text-gray-350 font-semibold py-2.5 rounded-xl shadow border border-gray-700 transition-all duration-300 flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <span>💬</span>
                      <span>Send Proof on WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}