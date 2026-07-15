'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SubscriptionRow = {
  id: string
  plan: string
  status: 'active' | 'suspended'
  ends_at: string | null
  notes: string | null
  payment_notes: string | null
  last_payment_at: string | null
  last_payment_amount: number | null
  payment_status: string | null
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

type PlanRow = {
  id: string
  name: string
  price: number
  price_label: string
  features: string[]
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

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

type SubscriptionsTabProps = {
  plans: PlanRow[]
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function SubscriptionsTab({ plans, showToast }: SubscriptionsTabProps) {
  const [mandals, setMandals] = useState<EnrichedMandal[]>([])
  const [loading, setLoading] = useState(true)

  // Edit Mandal modal
  const [editing, setEditing] = useState<EnrichedMandal | null>(null)
  const [formPlan, setFormPlan] = useState<string>('basic')
  const [formEndsAt, setFormEndsAt] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'suspended'>('active')
  const [formAmountPaid, setFormAmountPaid] = useState('')
  const [formMarkPaid, setFormMarkPaid] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Filter
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all')
  const [search, setSearch] = useState('')
  const [activeSubTab, setActiveSubTab] = useState<'current' | 'history'>('current')

  // Quick Pay Modal State
  const [payingMandal, setPayingMandal] = useState<EnrichedMandal | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Subscription Payment UPI Config State
  const [subUpiId, setSubUpiId] = useState('intellidon@upi')
  const [savingUpi, setSavingUpi] = useState(false)

  useEffect(() => {
    fetchMandals()
    fetchSettings()
  }, [])

  // ── Fetch Settings ───────────────────────────────────────────
  async function fetchSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.settings) {
        const upi = data.settings.find((s: any) => s.key === 'subscription_upi_id')?.value
        if (upi) setSubUpiId(upi)
      }
    } catch (err) {
      console.error('Could not fetch settings', err)
    }
  }

  // ── Save Subscription UPI ID ─────────────────────────────────
  async function saveSubUpiId() {
    if (!subUpiId || !subUpiId.trim()) {
      showToast('UPI ID is required', 'error')
      return
    }
    setSavingUpi(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ key: 'subscription_upi_id', value: subUpiId.trim() })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Subscription UPI ID saved successfully', 'success')
      } else {
        showToast(data.error || 'Could not save setting', 'error')
      }
    } catch (err) {
      showToast('Could not save setting', 'error')
    }
    setSavingUpi(false)
  }

  // ── Fetch ───────────────────────────────────────────────────
  async function fetchMandals() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/subscriptions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (!data.error) {
        setMandals((data.mandals as MandalRow[]).map(enrichMandal))
      } else {
        showToast(data.error, 'error')
      }
    } catch (err) {
      showToast('Could not fetch subscriptions', 'error')
    }
    setLoading(false)
  }

  // ── Confirm Payment Received ─────────────────────────────────
  async function handleConfirmPayment() {
    if (!payingMandal || !payingMandal.activeSub) return
    setPaySubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mandal_id: payingMandal.id,
          mark_paid: { amount: parseFloat(payAmount) },
          notes: payNotes || `Payment recorded on ${new Date().toLocaleDateString('en-IN')}`
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Payment recorded successfully', 'success')
        setPayingMandal(null)
        await fetchMandals()
      } else {
        showToast(data.error || 'Could not record payment', 'error')
      }
    } catch (err) {
      showToast('Could not record payment', 'error')
    }
    setPaySubmitting(false)
  }

  // ── Open edit modal ─────────────────────────────────────────
  function openEdit(m: EnrichedMandal) {
    setEditing(m)
    setFormPlan(m.activeSub?.plan || 'basic')
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

  // ── Save Subscription ──────────────────────────────────────────
  async function saveSubscription() {
    if (!editing) return
    if (!formEndsAt) { showToast('End date is required', 'error'); return }

    // Validate that new subscription ends at least 30 days in the future
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 30)
    minDate.setHours(0, 0, 0, 0)

    const selectedDate = new Date(formEndsAt)
    selectedDate.setHours(0, 0, 0, 0)

    if (selectedDate < minDate) {
      showToast('New subscription allotment must be at least 30 days (1 month)', 'error')
      return
    }

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

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
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
    } catch (err) {
      showToast('Could not save', 'error')
    }
    setFormSubmitting(false)
  }

  // ── Quick extend ────────────────────────────────────────────
  async function quickExtend(m: EnrichedMandal, days: number) {
    const base = m.activeSub?.ends_at && !m.isExpired
      ? new Date(m.activeSub.ends_at)
      : new Date()
    base.setDate(base.getDate() + days)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
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
    } catch (err) {
      showToast('Could not extend', 'error')
    }
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

  // Compile all allotment history logs
  const historyLogs = mandals.flatMap(m => {
    const activeSub = m.activeSub
    if (!activeSub || !activeSub.payment_notes) return []
    try {
      const logs = JSON.parse(activeSub.payment_notes)
      if (!Array.isArray(logs)) return []
      return logs.map((log: any) => ({
        ...log,
        mandal_id: m.id,
        mandal_name: m.name,
        mandal_city: m.city
      }))
    } catch {
      return []
    }
  })

  // Filter history logs
  const filteredHistoryLogs = historyLogs
    .filter(log => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        log.mandal_name.toLowerCase().includes(q) ||
        (log.mandal_city && log.mandal_city.toLowerCase().includes(q)) ||
        log.plan.toLowerCase().includes(q) ||
        (log.created_by && log.created_by.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const activeCount = mandals.filter(m => !m.isExpired).length
  const expiredCount = mandals.filter(m => m.isExpired).length
  const expiringSoon = mandals.filter(m => !m.isExpired && m.daysRemaining <= 7).length

  return (
    <div className="space-y-6">
      {/* Edit Mandal Subscription Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{editing.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{editing.city} · {editing.id.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white text-lg mt-0.5 cursor-pointer">✕</button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Plan selection */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-medium">Plan</label>
                {plans.length === 0 ? (
                  <p className="text-xs text-gray-550 italic">No plans available. Manage plans first.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {plans.map(p => (
                      <button key={p.id} onClick={() => setFormPlan(p.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-colors flex flex-col items-center justify-center cursor-pointer
                          ${formPlan === p.id
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        <span className="font-bold">{p.name}</span>
                        <span className="text-[10px] opacity-75 mt-0.5">{p.price_label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['active', 'suspended'] as const).map(s => (
                    <button key={s} onClick={() => setFormStatus(s)}
                      className={`py-2 rounded-lg text-xs font-medium capitalize border transition-colors cursor-pointer
                        ${formStatus === s
                          ? s === 'active' ? 'bg-green-700 border-green-600 text-white' : 'bg-red-900 border-red-700 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* End date */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block font-medium">Valid until *</label>
                <input type="date" min={addDays(30)} value={formEndsAt} onChange={e => setFormEndsAt(e.target.value)}
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
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mark payment */}
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors cursor-pointer">
                  {formSubmitting ? 'Saving...' : 'Save Subscription'}
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-header info row */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Mandal Subscriptions</h2>
          <p className="text-xs text-gray-400">View and extend community organization subscription tiers.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-[11px] bg-emerald-900/40 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
            {activeCount} active
          </span>
          {expiringSoon > 0 && (
            <span className="text-[11px] bg-yellow-900/40 text-yellow-400 px-2.5 py-1 rounded-full font-medium">
              {expiringSoon} expiring soon
            </span>
          )}
          <span className="text-[11px] bg-rose-900/40 text-rose-455 px-2.5 py-1 rounded-full font-medium">
            {expiredCount} expired
          </span>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-4 border-b border-gray-800">
        <button
          onClick={() => setActiveSubTab('current')}
          className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all cursor-pointer
            ${activeSubTab === 'current'
              ? 'border-orange-500 text-orange-500 font-bold'
              : 'border-transparent text-gray-450 hover:text-white'}`}
        >
          💳 Active Subscriptions
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all cursor-pointer
            ${activeSubTab === 'history'
              ? 'border-orange-500 text-orange-500 font-bold'
              : 'border-transparent text-gray-455 hover:text-white'}`}
        >
          📜 Allotment History
        </button>
      </div>

      {/* Subscription UPI ID Configuration Card */}
      <div className="bg-gray-900 border border-gray-850 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider block">Subscription Payment UPI ID</h4>
          <p className="text-[11px] text-gray-400">
            Configure the UPI ID shown to mandal admins on their subscription page for payments.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={subUpiId}
            onChange={e => setSubUpiId(e.target.value)}
            placeholder="e.g. intellidon@upi"
            className="flex-1 sm:w-64 bg-gray-850 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={saveSubUpiId}
            disabled={savingUpi}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            {savingUpi ? 'Saving...' : 'Save UPI'}
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={activeSubTab === 'history' ? "Search mandal, plan, or admin..." : "Search mandal name or city..."}
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
        />
        {activeSubTab === 'current' && (
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            {(['all', 'active', 'expired'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer
                  ${filter === f ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Contents */}
      {activeSubTab === 'current' ? (
        /* Mandal list */
        loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
            </div>
            <p className="text-[10px] text-gray-500 font-mono animate-pulse">Loading subscriptions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-sm">No mandals found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(m => (
              <div key={m.id}
                className={`bg-gray-900 border rounded-xl p-4 flex items-start justify-between gap-4
                  ${m.isExpired
                    ? 'border-red-900/40'
                    : m.daysRemaining <= 7
                      ? 'border-yellow-800/50'
                      : 'border-gray-800'}`}>

                {/* Left: mandal info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">{m.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize
                      ${m.isExpired
                        ? 'bg-red-955 text-red-400'
                        : m.daysRemaining <= 7
                          ? 'bg-yellow-950 text-yellow-450'
                          : 'bg-green-950 text-green-400'}`}>
                      {m.isExpired ? 'Expired' : `${m.daysRemaining}d left`}
                    </span>
                    {m.activeSub && (
                      <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full capitalize border border-gray-700">
                        {m.activeSub.plan}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{m.city}</p>
                  {m.activeSub ? (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <p className="text-[11px] text-gray-500">
                        {m.isExpired
                          ? `Expired ${fmtDate(m.activeSub.ends_at)}`
                          : `Valid until ${fmtDate(m.activeSub.ends_at)}`}
                      </p>
                      {m.activeSub.payment_status === 'unpaid' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const activePlan = plans.find(p => p.id === m.activeSub?.plan)
                            const planPrice = activePlan?.price || 0
                            setPayingMandal(m)
                            setPayAmount(planPrice ? planPrice.toString() : '')
                            setPayNotes('')
                          }}
                          className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                        >
                          Unpaid
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none">
                            Paid
                          </span>
                          {m.activeSub.last_payment_amount && (
                            <span className="text-[10px] text-emerald-450 font-medium">
                              (Last paid ₹{m.activeSub.last_payment_amount}
                              {m.activeSub.last_payment_at && ` on ${fmtDate(m.activeSub.last_payment_at)}`})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-600 mt-1">No subscription</p>
                  )}
                  {m.activeSub?.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{m.activeSub.notes}</p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {/* Quick extend buttons */}
                  <button onClick={() => quickExtend(m, 30)}
                    className="text-xs bg-gray-800 hover:bg-gray-750 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                    +30d
                  </button>
                  <button onClick={() => quickExtend(m, 90)}
                    className="text-xs bg-gray-800 hover:bg-gray-750 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                    +3mo
                  </button>
                  <button onClick={() => openEdit(m)}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Allotment History Table */
        loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
            </div>
            <p className="text-[10px] text-gray-550 font-mono animate-pulse">Loading logs...</p>
          </div>
        ) : filteredHistoryLogs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-sm">No allotment history found.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-400 font-medium">
                    <th className="p-3">Mandal</th>
                    <th className="p-3">Plan Allotted</th>
                    <th className="p-3">Valid Until</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Allotted By</th>
                    <th className="p-3">Allotment Date</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filteredHistoryLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/10 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-white">{log.mandal_name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{log.mandal_city}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wide border
                          ${log.plan === 'standard'
                            ? 'bg-indigo-950 text-indigo-400 border-indigo-900/20'
                            : log.plan === 'basic'
                            ? 'bg-orange-950 text-orange-400 border-orange-900/20'
                            : 'bg-gray-850 text-gray-300 border-gray-700/20'
                          }`}
                        >
                          {log.plan}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-300">
                        {fmtDate(log.ends_at)}
                      </td>
                      <td className="p-3 font-semibold text-green-400">
                        {log.amount_paid !== null && log.amount_paid !== undefined ? `₹${log.amount_paid.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="p-3 font-medium text-gray-300">
                        {log.created_by}
                      </td>
                      <td className="p-3 text-gray-550">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 text-gray-550 italic max-w-xs truncate" title={log.notes || ''}>
                        {log.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Quick Pay Modal */}
      {payingMandal && payingMandal.activeSub && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Record Subscription Payment</h3>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                {payingMandal.name} · {payingMandal.activeSub.plan} plan
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-455 block font-medium">Amount Received (₹)</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="e.g. 599"
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-455 block font-medium">Notes / Method</label>
              <input
                type="text"
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="e.g. GPay transaction, cash, etc."
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmPayment}
                disabled={paySubmitting || !payAmount}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {paySubmitting ? 'Processing...' : 'Mark as Paid'}
              </button>
              <button
                onClick={() => setPayingMandal(null)}
                className="px-4 bg-gray-750 hover:bg-gray-700 text-gray-300 rounded-xl text-xs transition-colors cursor-pointer border border-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
