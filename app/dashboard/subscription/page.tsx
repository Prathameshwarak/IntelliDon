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
  const [showMobileQr, setShowMobileQr] = useState(false)

  // Subscription hook for normal admin
  const sub = useSubscription(mandalId)

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const meData = await res.json()
        if (!res.ok || meData.error || !meData.user || !meData.profile) {
          router.push('/login')
          return
        }

        const role = meData.profile.role
        if (!['super_admin', 'admin', 'manager'].includes(role)) {
          router.push('/')
          return
        }

        if (role === 'super_admin') {
          router.push('/super-admin/subscriptions')
          return
        }

        setMandalId(meData.profile.mandal_id)
        if (meData.mandal) {
          setMandalName(meData.mandal.name || '')
        }
        if (meData.profile) {
          setAdminName(meData.profile.full_name || '')
          setAdminPhone(meData.profile.phone || '')
          setAdminEmail(meData.user?.email || '')
        }

        setAuthorized(true)
      } catch (e) {
        router.push('/')
      }
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
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Checking access...</p>
      </div>
    )
  }

  if (sub.loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Loading subscription details...</p>
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
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white p-4 sm:p-6 md:p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white text-xs font-bold transition-colors mb-6 group cursor-pointer">
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1A1208]/10 dark:border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-[#1A1208] dark:text-white">
                Subscription Plan
              </h1>
              {mandalName && (
                <span className="text-xs bg-[#E8650A]/10 border border-[#E8650A]/30 text-[#E8650A] dark:text-orange-400 px-3 py-1 rounded-full font-bold mt-1">
                  {mandalName}
                </span>
              )}
            </div>
            <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-medium mt-1">View your mandal's active subscription and plans</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Column 1: Current Status */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-sm">
              {/* Subtle gradient background glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8650A]/10 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold uppercase tracking-wider mb-4">
                Current Status
              </h2>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Plan</p>
                  <p className="text-xl font-bold text-[#1A1208] dark:text-white mt-1 capitalize font-sans">
                    {sub.subscription?.plan || 'No Active Plan'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Status</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${sub.isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                    <span className={`text-sm font-bold capitalize ${sub.isExpired ? 'text-rose-600 dark:text-red-400' : 'text-emerald-600 dark:text-green-400'}`}>
                      {sub.isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Validity</p>
                  <p className="text-sm font-bold text-[#1A1208] dark:text-white mt-1">
                    {sub.subscription?.ends_at 
                      ? `${fmtDate(sub.subscription.ends_at)} (${sub.daysRemaining} days remaining)`
                      : 'N/A'}
                  </p>
                </div>

                {sub.subscription?.notes && (
                  <div className="border-t border-[#1A1208]/10 dark:border-gray-800 pt-3">
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 font-bold">Notes</p>
                    <p className="text-xs text-[#1A1208] dark:text-gray-300 italic whitespace-pre-line bg-white/60 dark:bg-gray-950/40 p-2.5 rounded-lg border border-[#1A1208]/10 dark:border-gray-800/50 font-medium">
                      {sub.subscription.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Available Plans */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1A1208] dark:text-white mb-2">Available Subscription Plans</h2>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-6 font-medium">Select a plan to upgrade or renew. Contact support to finalize payment.</p>

              {displayPlans.length === 0 ? (
                <p className="text-sm text-[#7a6a55] dark:text-gray-500 italic py-6 font-medium">No upgrade plans currently configured.</p>
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
                        className={`rounded-2xl p-5 border relative flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] cursor-pointer shadow-sm
                          ${isSelected
                            ? 'border-[#E8650A] bg-white dark:bg-orange-500/10 ring-2 ring-[#E8650A]/30 shadow-[#E8650A]/10 shadow-lg'
                            : isCurrent 
                              ? 'border-emerald-500/50 bg-emerald-500/10 dark:bg-green-950/10' 
                              : isPopular 
                                ? 'border-[#E8650A]/40 bg-[#E8650A]/5 shadow-md' 
                                : 'border-[#1A1208]/15 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-[#E8650A]'}`}
                      >
                        {isCurrent && (
                          <span className="absolute top-3 right-3 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/30">
                            Current Plan
                          </span>
                        )}
                        {!isCurrent && isPopular && (
                          <span className="absolute top-3 right-3 text-[10px] bg-[#E8650A]/20 text-[#E8650A] dark:text-orange-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-[#E8650A]/30">
                            Popular
                          </span>
                        )}

                        <div>
                          <p className="text-[#1A1208] dark:text-white font-bold text-sm capitalize">{p.name}</p>
                          <p className={`text-base font-extrabold mt-1.5 ${isCurrent ? 'text-emerald-700 dark:text-green-400' : isPopular ? 'text-[#E8650A] dark:text-orange-400' : 'text-[#1A1208] dark:text-white'}`}>
                            {p.price_label}
                          </p>

                          {p.features && p.features.length > 0 && (
                            <ul className="mt-5 space-y-2.5">
                              {p.features.map(f => (
                                <li key={f} className="flex items-start gap-2 text-xs text-[#7a6a55] dark:text-gray-300 font-medium">
                                  <span className="text-emerald-600 dark:text-green-400 font-bold flex-shrink-0 mt-0.5">✓</span>
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
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-[#1A1208]/10 dark:border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-[#1A1208] dark:text-white">How to Upgrade or Renew</h3>
                <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
                  Follow the steps below to make subscription payment and activate your plan.
                </p>
              </div>

              {!selectedPlan ? (
                <div className="bg-white/60 dark:bg-gray-950/40 border border-dashed border-[#1A1208]/15 dark:border-gray-800 rounded-xl p-8 text-center">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">Please click and select one of the available subscription plans above to proceed with the payment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  <div className="bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] bg-[#E8650A]/10 text-[#E8650A] dark:text-orange-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#E8650A]/20">
                        Step 1: UPI Payment
                      </span>
                      
                      {/* Mobile View: Proceed Button */}
                      <div className="block md:hidden mt-3 space-y-3">
                        <p className="text-xs text-[#7a6a55] dark:text-gray-300 font-medium">
                          Click the button below to open your UPI app and pay for the <strong>{selectedPlan.name}</strong> plan.
                        </p>
                        <a 
                          href={`upi://pay?pa=${encodeURIComponent(subUpiId)}&pn=${encodeURIComponent('Intellidon Subscription')}&am=${selectedPlan.price.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
                            `Plan: ${selectedPlan.name}, Price: Rs. ${selectedPlan.price}`
                          )}`}
                          className="w-full bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-2 text-xs cursor-pointer text-center"
                        >
                          <span>⚡</span>
                          <span>Proceed for Payment (Pay ₹{selectedPlan.price})</span>
                        </a>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => setShowMobileQr(!showMobileQr)}
                            className="text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold cursor-pointer"
                          >
                            {showMobileQr ? 'Hide QR Code' : "Don't have a UPI app? Show QR Code"}
                          </button>
                        </div>

                        {showMobileQr && (
                          <div className="flex flex-col items-center gap-4 mt-3 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 p-4 rounded-xl animate-fade-in">
                            <div className="p-1.5 bg-white rounded-lg shadow-sm">
                              <UpiQR 
                                upiId={subUpiId}
                                name="Intellidon Subscription"
                                amount={selectedPlan.price}
                                note={`Plan: ${selectedPlan.name}, Price: Rs. ${selectedPlan.price}`}
                                size={150}
                              />
                            </div>
                            
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-950 p-2 rounded-lg border border-[#1A1208]/10 dark:border-gray-800 w-full">
                              <span className="text-[11px] text-[#E8650A] dark:text-orange-400 font-mono select-all font-bold flex-1 text-center truncate">
                                {subUpiId}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(subUpiId)
                                  alert('UPI ID copied to clipboard!')
                                }}
                                className="text-[10px] bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 px-2 py-1 rounded font-bold cursor-pointer transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Desktop View: QR Code & UPI ID only */}
                      <div className="hidden md:flex flex-col items-center gap-4 mt-3">
                        <p className="text-xs text-[#7a6a55] dark:text-gray-300 text-center font-medium">
                          Scan the QR code below or use the UPI ID to pay for the <strong>{selectedPlan.name}</strong> plan.
                        </p>
                        
                        <div className="p-1.5 bg-white rounded-lg shadow-sm">
                          <UpiQR 
                            upiId={subUpiId}
                            name="Intellidon Subscription"
                            amount={selectedPlan.price}
                            note={`Plan: ${selectedPlan.name}, Price: Rs. ${selectedPlan.price}`}
                            size={160}
                          />
                        </div>

                        <div className="flex items-center gap-2 bg-[#F5EDE2] dark:bg-gray-900 p-2 rounded-lg border border-[#1A1208]/10 dark:border-gray-800 w-full">
                          <span className="text-[11px] text-[#E8650A] dark:text-orange-400 font-mono select-all font-bold flex-1 text-center truncate">
                            {subUpiId}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(subUpiId)
                              alert('UPI ID copied to clipboard!')
                            }}
                            className="text-[10px] bg-white dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 px-2 py-1 rounded font-bold transition-colors cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-green-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Step 2: Submit Proof
                      </span>
                      <p className="text-xs text-[#7a6a55] dark:text-gray-300 mt-2 font-medium">
                        After making the payment, send the screenshot on WhatsApp to get instant activation.
                      </p>
                    </div>
                    <a 
                      href={getWhatsAppUrl()}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 font-bold py-2.5 rounded-xl shadow border border-[#1A1208]/10 dark:border-gray-700 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
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