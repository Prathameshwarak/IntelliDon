'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PLANS, SUPPORT_WHATSAPP_URL, useSubscription, type PlanKey } from '@/lib/subscription'

// ── Types ──────────────────────────────────────────────────────
type SubscriptionRow = {
  id: string
  plan: PlanKey
  status: 'active' | 'suspended'
  ends_at: string | null
  notes: string | null
  last_payment_at: string | null
  last_payment_amount: number | null
  updated_at: string | null
}

type MandalRow = {
  id: string
  name: string
  slug: string
  city: string
  status: string
  subscriptions: SubscriptionRow[]
}

type EnrichedMandal = MandalRow & {
  activeSub: SubscriptionRow | null
  isExpired: boolean
  daysRemaining: number
}

// ── Helpers ────────────────────────────────────────────────────
function daysLeft(endsAt: string | null): number {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000))
}

function isExpired(sub: SubscriptionRow | null): boolean {
  if (!sub) return true
  if (sub.status === 'suspended') return true
  if (!sub.ends_at) return true
  return new Date(sub.ends_at).getTime() < Date.now()
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function enrichMandal(m: MandalRow): EnrichedMandal {
  const active = (m.subscriptions || [])
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0] || null
  return {
    ...m,
    activeSub: active,
    isExpired: isExpired(active),
    daysRemaining: daysLeft(active?.ends_at || null)
  }
}

// Quick date presets
function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Component ──────────────────────────────────────────────────
export default function SuperAdminSubscriptionsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [callerId, setCallerId] = useState<string | null>(null)
  const [mandals, setMandals] = useState<EnrichedMandal[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // User details
  const [userRole, setUserRole] = useState<string>('')
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')

  // Subscription hook for normal admin
  const sub = useSubscription(mandalId)

  // Edit modal
  const [editing, setEditing] = useState<EnrichedMandal | null>(null)
  const [formPlan, setFormPlan] = useState<PlanKey>('basic')
  const [formEndsAt, setFormEndsAt] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'suspended'>('active')
  const [formAmountPaid, setFormAmountPaid] = useState('')
  const [formMarkPaid, setFormMarkPaid] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Filter
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all')
  const [search, setSearch] = useState('')

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

      setCallerId(user.id)
      setUserRole(userRow.role)
      setMandalId(userRow.mandal_id)

      if (userRow.role !== 'super_admin' && userRow.mandal_id) {
        const { data: mandal } = await supabase
          .from('mandals')
          .select('name')
          .eq('id', userRow.mandal_id)
          .single()
        setMandalName(mandal?.name || '')
      }

      setAuthorized(true)
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    if (authorized && userRole === 'super_admin') fetchMandals()
  }, [authorized, userRole])

  // ── Fetch ───────────────────────────────────────────────────
  async function fetchMandals() {
    setLoading(true)
    const res = await fetch('/api/super-admin/subscriptions')
    const data = await res.json()
    if (!data.error) {
      setMandals((data.mandals as MandalRow[]).map(enrichMandal))
    } else {
      showToast(data.error, 'error')
    }
    setLoading(false)
  }

  // ── Open edit modal ─────────────────────────────────────────
  function openEdit(m: EnrichedMandal) {
    setEditing(m)
    setFormPlan((m.activeSub?.plan as PlanKey) || 'basic')
    setFormEndsAt(
      m.activeSub?.ends_at
        ? new Date(m.activeSub.ends_at).toISOString().split('T')[0]
        : addDays(30)
    )
    setFormStatus((m.activeSub?.status as 'active' | 'suspended') || 'active')
    setFormAmountPaid(m.activeSub?.last_payment_amount?.toString() || '')
    setFormMarkPaid(false)
    setFormNotes(m.activeSub?.notes || '')
  }

  // ── Save ────────────────────────────────────────────────────
  async function saveSubscription() {
    if (!editing) return
    if (!formEndsAt) { showToast('End date is required', 'error'); return }

    setFormSubmitting(true)
    const body: Record<string, unknown> = {
      mandal_id: editing.id,
      plan: formPlan,
      ends_at: new Date(formEndsAt).toISOString(),
      status: formStatus,
      notes: formNotes || null,
    }
    if (formMarkPaid && formAmountPaid) {
      body.mark_paid = { amount: parseFloat(formAmountPaid) }
    }

    const res = await fetch('/api/super-admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (data.success) {
      showToast('Subscription saved', 'success')
      setEditing(null)
      await fetchMandals()
    } else {
      showToast(data.error || 'Could not save', 'error')
    }
    setFormSubmitting(false)
  }

  // ── Quick extend ────────────────────────────────────────────
  async function quickExtend(m: EnrichedMandal, days: number) {
    const base = m.activeSub?.ends_at && !m.isExpired
      ? new Date(m.activeSub.ends_at)
      : new Date()
    base.setDate(base.getDate() + days)

    const res = await fetch('/api/super-admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandal_id: m.id,
        plan: m.activeSub?.plan || 'trial',
        status: 'active',
        ends_at: base.toISOString(),
        notes: `Extended +${days} days on ${fmtDate(new Date().toISOString())}`
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast(`Extended by ${days} days`, 'success')
      await fetchMandals()
    } else {
      showToast(data.error || 'Could not extend', 'error')
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Filtered list ───────────────────────────────────────────
  const filtered = mandals
    .filter(m => {
      if (filter === 'active') return !m.isExpired
      if (filter === 'expired') return m.isExpired
      return true
    })
    .filter(m => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q)
    })

  const activeCount = mandals.filter(m => !m.isExpired).length
  const expiredCount = mandals.filter(m => m.isExpired).length
  const expiringSoon = mandals.filter(m => !m.isExpired && m.daysRemaining <= 7).length

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Checking access...</p>
      </div>
    )
  }

  if (userRole !== 'super_admin') {
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['basic', 'standard'] as const).map(key => {
                    const p = PLANS[key]
                    const isPopular = key === 'standard'
                    const isCurrent = sub.subscription?.plan === key

                    return (
                      <div 
                        key={key} 
                        className={`rounded-2xl p-5 border relative flex flex-col justify-between transition-all duration-300 hover:scale-[1.01]
                          ${isCurrent 
                            ? 'border-green-500/50 bg-green-950/10 shadow-green-950/20' 
                            : isPopular 
                              ? 'border-orange-500 bg-orange-500/5 shadow-orange-950/20 shadow-lg' 
                              : 'border-gray-800 bg-gray-950 hover:border-gray-700'}`}
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
                            {p.priceLabel}
                          </p>

                          <ul className="mt-5 space-y-2.5">
                            {p.features.map(f => (
                              <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                                <span className="text-green-400 font-bold flex-shrink-0 mt-0.5">✓</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* WhatsApp CTA */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-orange-400/20">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Upgrade or Renew via WhatsApp</h3>
                  <p className="text-xs text-orange-100 mt-1 max-w-md">
                    Click the button to text our support team on WhatsApp. Please keep the generated message intact so we can quickly verify your mandal.
                  </p>
                </div>

                <a 
                  href={getWhatsAppUrl()}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-shrink-0 bg-white hover:bg-orange-50 text-orange-600 font-bold px-5 py-3 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                >
                  <span>💬</span>
                  <span>Upgrade Now</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-xl
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{editing.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{editing.city} · {editing.id.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white text-lg mt-0.5">✕</button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">

              {/* Plan */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-medium">Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PLANS) as PlanKey[]).map(p => (
                    <button key={p} onClick={() => setFormPlan(p)}
                      className={`py-2 rounded-lg text-xs font-medium capitalize border transition-colors
                        ${formPlan === p
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {PLANS[p].name}
                      <span className="block text-gray-500 font-normal text-xs mt-0.5">
                        {p === 'trial' ? 'Free' : PLANS[p].priceLabel.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['active', 'suspended'] as const).map(s => (
                    <button key={s} onClick={() => setFormStatus(s)}
                      className={`py-2 rounded-lg text-xs font-medium capitalize border transition-colors
                        ${formStatus === s
                          ? s === 'active' ? 'bg-green-700 border-green-600 text-white' : 'bg-red-900 border-red-700 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* End date + quick presets */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-medium">Valid until *</label>
                <input type="date" value={formEndsAt} onChange={e => setFormEndsAt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  style={{ colorScheme: 'dark' }} />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { label: '+30d', days: 30 },
                    { label: '+3mo', days: 90 },
                    { label: '+6mo', days: 180 },
                    { label: '+1yr', days: 365 }
                  ].map(p => (
                    <button key={p.label}
                      onClick={() => setFormEndsAt(addDays(p.days))}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mark as paid */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                    ${formMarkPaid ? 'bg-green-600 border-green-600' : 'border-gray-500'}`}
                    onClick={() => setFormMarkPaid(v => !v)}>
                    {formMarkPaid && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-xs text-gray-300 font-medium">Mark payment received</span>
                </label>
                {formMarkPaid && (
                  <input type="number" value={formAmountPaid} onChange={e => setFormAmountPaid(e.target.value)}
                    placeholder="Amount paid (₹)"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-medium">Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  rows={2} placeholder="e.g. Paid via GPay on 5 Jul 2026"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={saveSubscription} disabled={formSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {formSubmitting ? 'Saving...' : 'Save Subscription'}
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/super-admin/mandals" className="text-gray-400 hover:text-white text-sm transition-colors">← Mandals</Link>
          <div>
            <p className="text-xs text-gray-400">Super Admin</p>
            <p className="text-sm font-semibold">Subscription Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-xs bg-green-900/50 text-green-400 px-3 py-1.5 rounded-full font-medium">
            {activeCount} active
          </span>
          {expiringSoon > 0 && (
            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-3 py-1.5 rounded-full font-medium">
              {expiringSoon} expiring soon
            </span>
          )}
          <span className="text-xs bg-red-900/50 text-red-400 px-3 py-1.5 rounded-full font-medium">
            {expiredCount} expired
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Search + filter bar */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search mandal name or city..."
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            {(['all', 'active', 'expired'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors
                  ${filter === f ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mandal list */}
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-12">Loading subscriptions...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-12">No mandals found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(m => (
              <div key={m.id}
                className={`bg-gray-800 border rounded-xl p-4 flex items-start justify-between gap-4
                  ${m.isExpired
                    ? 'border-red-900/50'
                    : m.daysRemaining <= 7
                      ? 'border-yellow-800/60'
                      : 'border-gray-700'}`}>

                {/* Left: mandal info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">{m.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize
                      ${m.isExpired
                        ? 'bg-red-900/50 text-red-400'
                        : m.daysRemaining <= 7
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-green-900/50 text-green-400'}`}>
                      {m.isExpired ? 'Expired' : `${m.daysRemaining}d left`}
                    </span>
                    {m.activeSub && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">
                        {m.activeSub.plan}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{m.city}</p>
                  {m.activeSub ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {m.isExpired
                        ? `Expired ${fmtDate(m.activeSub.ends_at)}`
                        : `Valid until ${fmtDate(m.activeSub.ends_at)}`}
                      {m.activeSub.last_payment_amount && (
                        <span className="ml-2 text-green-400">
                          · Last paid ₹{m.activeSub.last_payment_amount}
                          {m.activeSub.last_payment_at && ` on ${fmtDate(m.activeSub.last_payment_at)}`}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-1">No subscription</p>
                  )}
                  {m.activeSub?.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{m.activeSub.notes}</p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  {/* Quick extend buttons */}
                  <button onClick={() => quickExtend(m, 30)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors">
                    +30d
                  </button>
                  <button onClick={() => quickExtend(m, 90)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors">
                    +3mo
                  </button>
                  <button onClick={() => openEdit(m)}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}