'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────
type Tab = 'donations' | 'events' | 'team'

type Donation = {
  id: string
  receipt_number: string
  donor_name: string
  donor_phone: string
  donor_address: string | null
  amount: number
  payment_mode: string
  status: string
  screenshot_url: string | null
  created_at: string
  users: { full_name: string } | null
  pdf_url: string | null
}

type Summary = {
  total_count: number
  total_amount: number
  verified_amount: number
  pending_count: number
}

type Event = {
  id: string
  name: string
  year: number
  upi_id: string | null
  is_active: boolean
}

type Member = {
  id: string
  full_name: string
  phone: string
  role: string
}

// ── Role capability map — single source of truth ───────────────
// Change permissions here and the entire UI updates automatically
const CAN = {
  verifyDonation:  (role: string) => ['admin', 'manager'].includes(role),
  createEvent:     (role: string) => role === 'admin',
  toggleEvent:     (role: string) => role === 'admin',
  addMember:       (role: string) => role === 'admin',
  removeMember:    (role: string) => role === 'admin',
  seeTeamTab:      (role: string) => role === 'admin',   // manager cannot manage team
  seeEventsTab:    (role: string) => ['admin', 'manager'].includes(role),
}

export default function DashboardPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')

  // Default tab — manager only sees donations, admin sees all
  const [tab, setTab] = useState<Tab>('donations')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Donations state
  const [donations, setDonations] = useState<Donation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [screenshotChecked, setScreenshotChecked] = useState(false)

  // Events state
  const [events, setEvents] = useState<Event[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventYear, setEventYear] = useState(new Date().getFullYear().toString())
  const [eventUpiId, setEventUpiId] = useState('')
  const [eventSubmitting, setEventSubmitting] = useState(false)

  // Team state
  const [members, setMembers] = useState<Member[]>([])
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberRole, setMemberRole] = useState<'collector' | 'manager'>('collector')
  const [memberSubmitting, setMemberSubmitting] = useState(false)

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, mandal_id')
        .eq('id', user.id)
        .single()

      // Only admin and manager reach this page
      // Collector → /collect, super_admin → /super-admin/mandals
      if (!userRow || !['admin', 'manager'].includes(userRow.role)) {
        if (userRow?.role === 'collector') router.push('/collect')
        else if (userRow?.role === 'super_admin') router.push('/super-admin/mandals')
        else router.push('/login')
        return
      }

      const { data: mandal } = await supabase
        .from('mandals')
        .select('id, name')
        .eq('id', userRow.mandal_id)
        .single()

      setUserId(user.id)
      setUserRole(userRow.role)
      setMandalId(userRow.mandal_id)
      setMandalName(mandal?.name || '')
      setLoading(false)
    }
    init()
  }, [router])

  // ── Load data on tab change ───────────────────────────────────
  useEffect(() => {
    if (!mandalId) return
    if (tab === 'donations') fetchDonations()
    if (tab === 'events') fetchEvents()
    if (tab === 'team') fetchTeam()
  }, [tab, mandalId])

  // ── Donations ─────────────────────────────────────────────────
  async function fetchDonations() {
    setDonationsLoading(true)
    const res = await fetch(`/api/donations?mandal_id=${mandalId}`)
    const data = await res.json()
    if (!data.error) {
      setDonations(data.donations)
      setSummary(data.summary)
    }
    setDonationsLoading(false)
  }

  async function verifyDonation(donationId: string) {
    if (!CAN.verifyDonation(userRole)) return
    setVerifyingId(donationId)
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donation_id: donationId, verified_by: userId })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Donation verified — receipt generated', 'success')
      setDonations(prev => prev.map(d =>
        d.id === donationId
          ? { ...d, status: 'verified', pdf_url: data.pdf_url || d.pdf_url }
          : d
      ))
      setSummary(prev => prev && donations.find(d => d.id === donationId)
        ? {
            ...prev,
            verified_amount: prev.verified_amount + Number(donations.find(d => d.id === donationId)?.amount || 0),
            pending_count: prev.pending_count - 1
          }
        : prev
      )
      // Close the review panel
      setReviewingId(null)
      setScreenshotChecked(false)
    } else {
      showToast(data.error || 'Could not verify', 'error')
    }
    setVerifyingId(null)
  }

  // ── Events ────────────────────────────────────────────────────
  async function fetchEvents() {
    const res = await fetch(`/api/events?mandal_id=${mandalId}`)
    const data = await res.json()
    if (!data.error) setEvents(data.events)
  }

  async function createEvent() {
    if (!CAN.createEvent(userRole)) return
    if (!eventName.trim() || !eventYear) { showToast('Name and year required', 'error'); return }
    setEventSubmitting(true)
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandal_id: mandalId, name: eventName, year: eventYear, upi_id: eventUpiId })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Event created', 'success')
      setEvents(prev => [data.event, ...prev])
      setEventName(''); setEventYear(new Date().getFullYear().toString()); setEventUpiId('')
      setShowEventForm(false)
    } else showToast(data.error || 'Could not create event', 'error')
    setEventSubmitting(false)
  }

  async function toggleEvent(eventId: string, currentActive: boolean) {
    if (!CAN.toggleEvent(userRole)) return
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, is_active: !currentActive })
    })
    const data = await res.json()
    if (data.success) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_active: !currentActive } : e))
      showToast(`Event ${!currentActive ? 'activated' : 'deactivated'}`, 'success')
    }
  }

  // ── Team ──────────────────────────────────────────────────────
  async function fetchTeam() {
    const res = await fetch(`/api/team?mandal_id=${mandalId}`)
    const data = await res.json()
    if (!data.error) setMembers(data.members)
  }

  async function addMember() {
    if (!CAN.addMember(userRole)) return
    if (!memberName || !memberPhone || !memberEmail || !memberPassword) {
      showToast('All fields required', 'error'); return
    }
    if (memberPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    setMemberSubmitting(true)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandal_id: mandalId, full_name: memberName, phone: memberPhone, email: memberEmail, password: memberPassword, role: memberRole })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Member added', 'success')
      setMembers(prev => [...prev, data.member])
      setMemberName(''); setMemberPhone(''); setMemberEmail(''); setMemberPassword('')
      setShowMemberForm(false)
    } else showToast(data.error || 'Could not add member', 'error')
    setMemberSubmitting(false)
  }

  async function removeMember(memberId: string) {
    if (!CAN.removeMember(userRole)) return
    if (!confirm('Remove this member? They will lose access immediately.')) return
    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: memberId })
    })
    const data = await res.json()
    if (data.success) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
      showToast('Member removed', 'success')
    } else showToast('Could not remove member', 'error')
  }

  // ── Helpers ───────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatAmount(n: number) {
    return '₹' + Number(n).toLocaleString('en-IN')
  }

  function paymentModeLabel(mode: string) {
    if (mode === 'cash') return '💵 Cash'
    if (mode === 'upi_collector') return '📱 UPI (collector)'
    if (mode === 'upi_self') return '📱 UPI (self)'
    return mode
  }

  // Available tabs depend on role
  const availableTabs: Tab[] = [
    'donations',
    ...(CAN.seeEventsTab(userRole) ? ['events' as Tab] : []),
    ...(CAN.seeTeamTab(userRole) ? ['team' as Tab] : []),
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
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

      {/* Screenshot lightbox */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={activeScreenshot} alt="Payment screenshot" className="w-full rounded-xl" />
            <button
              onClick={() => setActiveScreenshot(null)}
              className="mt-3 w-full bg-gray-800 text-gray-300 py-2 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Intellidon</p>
          <p className="text-base font-semibold">{mandalName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize
            ${userRole === 'admin'
              ? 'bg-orange-900/50 text-orange-400'
              : 'bg-blue-900/50 text-blue-400'}`}>
            {userRole === 'admin' ? 'Adhyaksha' : 'Khajindar'}
          </span>
          <button
            onClick={() => router.push('/share')}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            🔗 Share Link
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Role notice for manager */}
        {userRole === 'manager' && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-3 mb-5 text-xs text-blue-300">
            You are logged in as <strong>Khajindar (Manager)</strong>. You can view donations, verify cash, and view events. Team and event management is handled by the Adhyaksha.
          </div>
        )}

        {/* Summary cards */}
        {tab === 'donations' && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total donations', value: summary.total_count },
              { label: 'Total collected', value: formatAmount(summary.total_amount) },
              { label: 'Verified', value: formatAmount(summary.verified_amount) },
              { label: 'Pending verify', value: summary.pending_count },
            ].map(card => (
              <div key={card.label} className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                <p className="text-xl font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs — only show tabs the role has access to */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 mb-6 w-fit">
          {availableTabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors
                ${tab === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── TAB: Donations ── */}
        {tab === 'donations' && (
          <div>
            {donationsLoading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading donations...</p>
            ) : donations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No donations recorded yet.</p>
                <p className="text-gray-600 text-xs mt-1">Collectors will add donations from their screen.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {donations.map(d => {

                  const isReviewing = reviewingId === d.id
                  const isSelfDonation = d.payment_mode === 'upi_self'

                  return (
                    <div key={d.id}
                      className={`bg-gray-800 border rounded-xl overflow-hidden transition-all
                        ${isReviewing ? 'border-orange-500' : 'border-gray-700'}`}>

                      {/* ── Main row ── */}
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-white text-sm">{d.donor_name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                              ${d.status === 'verified'
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-yellow-900/50 text-yellow-400'}`}>
                              {d.status}
                            </span>
                            <span className="text-xs text-gray-500">
                              {d.payment_mode === 'cash' ? '💵 Cash'
                              : d.payment_mode === 'upi_collector' ? '📱 UPI'
                              : '🌐 Online'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {d.donor_phone}{d.donor_address ? ` · ${d.donor_address}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {d.users?.full_name ? `By ${d.users.full_name} · ` : ''}{formatDate(d.created_at)}
                          </p>
                          <p className="text-xs font-mono text-gray-600 mt-1">{d.receipt_number}</p>
                        </div>

                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                          <p className="text-xl font-bold text-white">{formatAmount(d.amount)}</p>

                          {/* ── Cash / UPI collector: simple verify button ── */}
                          {d.status === 'pending'
                            && CAN.verifyDonation(userRole)
                            && !isSelfDonation
                            && (
                            <button
                              onClick={() => verifyDonation(d.id)}
                              disabled={verifyingId === d.id}
                              className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50
                                text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {verifyingId === d.id ? '...' : '✓ Verify'}
                            </button>
                          )}

                          {/* ── Self donation: open review panel first ── */}
                          {d.status === 'pending'
                            && CAN.verifyDonation(userRole)
                            && isSelfDonation
                            && !isReviewing
                            && (
                            <button
                              onClick={() => {
                                setReviewingId(d.id)
                                setScreenshotChecked(false)
                              }}
                              className="text-xs bg-orange-600 hover:bg-orange-500
                                text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Review →
                            </button>
                          )}

                          {/* Close review panel */}
                          {isReviewing && (
                            <button
                              onClick={() => {
                                setReviewingId(null)
                                setScreenshotChecked(false)
                              }}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              ✕ Close
                            </button>
                          )}

                          {/* Receipt download */}
                          {d.pdf_url && (
                            <a
                              href={d.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              ↓ Receipt
                            </a>
                          )}
                        </div>
                      </div>

                      {/* ── Review panel — expands below the main row ── */}
                      {isReviewing && (
                        <div className="border-t border-orange-500/30 bg-gray-900 p-4 flex flex-col gap-4">

                          {/* Screenshot */}
                          {d.screenshot_url ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-medium text-gray-300">Payment Screenshot</p>
                              <img
                                src={d.screenshot_url}
                                alt="Payment screenshot"
                                className="w-full max-w-xs rounded-xl border border-gray-700 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                              <a
                                href={d.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Open full size ↗
                              </a>
                            </div>
                          ) : (
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
                              <p className="text-gray-500 text-xs">No screenshot uploaded by donor</p>
                            </div>
                          )}

                          {/* Donation summary */}
                          <div className="bg-gray-800 rounded-xl px-4 py-3 flex flex-col gap-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Donor</span>
                              <span className="text-white font-medium">{d.donor_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Phone</span>
                              <span className="text-white">{d.donor_phone}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Amount</span>
                              <span className="text-white font-bold">{formatAmount(d.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Receipt no.</span>
                              <span className="text-white font-mono">{d.receipt_number}</span>
                            </div>
                          </div>

                          {/* Confirmation checkbox */}
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                checked={screenshotChecked}
                                onChange={e => setScreenshotChecked(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                ${screenshotChecked
                                  ? 'bg-green-600 border-green-600'
                                  : 'border-gray-500 bg-gray-800 group-hover:border-gray-400'}`}>
                                {screenshotChecked && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-300 leading-relaxed">
                              I have reviewed the payment screenshot and confirm that
                              <span className="text-white font-medium"> ₹{Number(d.amount).toLocaleString('en-IN')}</span> was
                              received from <span className="text-white font-medium">{d.donor_name}</span>
                            </span>
                          </label>

                          {/* Confirm verify button — only appears after checkbox */}
                          {screenshotChecked && (
                            <button
                              onClick={() => verifyDonation(d.id)}
                              disabled={verifyingId === d.id}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50
                                text-white font-semibold py-3.5 rounded-xl text-sm transition-colors"
                            >
                              {verifyingId === d.id
                                ? 'Verifying & generating receipt...'
                                : '✓ Confirm Verified — Generate Receipt'}
                            </button>
                          )}

                          {!screenshotChecked && (
                            <p className="text-xs text-gray-600 text-center">
                              Tick the checkbox above to confirm before verifying
                            </p>
                          )}

                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Events (admin + manager can VIEW, only admin can edit) ── */}
        {tab === 'events' && CAN.seeEventsTab(userRole) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{events.length} event{events.length !== 1 ? 's' : ''}</p>
              {CAN.createEvent(userRole) && (
                <button
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
                >
                  + New Event
                </button>
              )}
            </div>

            {/* Create event form — admin only */}
            {showEventForm && CAN.createEvent(userRole) && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium">Create New Event</p>
                <input
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  placeholder="Event name e.g. Ganeshotsav"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={eventYear}
                    onChange={e => setEventYear(e.target.value)}
                    placeholder="Year"
                    type="number"
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                  <input
                    value={eventUpiId}
                    onChange={e => setEventUpiId(e.target.value)}
                    placeholder="UPI ID (optional)"
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createEvent}
                    disabled={eventSubmitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg"
                  >
                    {eventSubmitting ? 'Creating...' : 'Create Event'}
                  </button>
                  <button onClick={() => setShowEventForm(false)} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                {CAN.createEvent(userRole) ? 'No events yet. Create one above.' : 'No events created yet. Ask the Adhyaksha to create an event.'}
              </p>
            ) : (
              events.map(ev => (
                <div key={ev.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white text-sm">{ev.name} {ev.year}</p>
                    <p className="text-xs text-gray-400 mt-1">{ev.upi_id ? `UPI: ${ev.upi_id}` : 'No UPI ID set'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full
                      ${ev.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {ev.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {/* Only admin can toggle event */}
                    {CAN.toggleEvent(userRole) && (
                      <button
                        onClick={() => toggleEvent(ev.id, ev.is_active)}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        {ev.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: Team (admin only) ── */}
        {tab === 'team' && CAN.seeTeamTab(userRole) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              <button
                onClick={() => setShowMemberForm(!showMemberForm)}
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
              >
                + Add Member
              </button>
            </div>

            {/* Role guide */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-medium text-white text-sm mb-2">Role guide</p>
              <p><span className="text-orange-400 font-medium">Adhyaksha (Admin)</span> — full access. Manages team, events, and sees all data.</p>
              <p className="mt-1"><span className="text-blue-400 font-medium">Khajindar (Manager)</span> — can view donations and verify cash. Cannot manage team or events.</p>
              <p className="mt-1"><span className="text-gray-300 font-medium">Sevak (Collector)</span> — can only enter new donations from their phone. Cannot see reports.</p>
            </div>

            {/* Add member form */}
            {showMemberForm && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium">Add Team Member</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['collector', 'manager'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setMemberRole(r)}
                      className={`py-2 rounded-lg text-xs font-medium border capitalize transition-colors
                        ${memberRole === r ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}
                    >
                      {r === 'collector' ? 'Sevak' : 'Khajindar'}
                      <span className="block text-gray-500 font-normal capitalize">{r}</span>
                    </button>
                  ))}
                </div>
                <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Full name"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberPhone} onChange={e => setMemberPhone(e.target.value)} placeholder="Phone number" type="tel"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Email (used to login)" type="email"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberPassword} onChange={e => setMemberPassword(e.target.value)} placeholder="Password (min 8 characters)" type="password"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <div className="flex gap-2">
                  <button onClick={addMember} disabled={memberSubmitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                    {memberSubmitting ? 'Adding...' : `Add ${memberRole === 'collector' ? 'Sevak' : 'Khajindar'}`}
                  </button>
                  <button onClick={() => setShowMemberForm(false)} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No team members yet.</p>
            ) : (
              members.map(m => (
                <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm">{m.full_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${m.role === 'admin' ? 'bg-orange-900/50 text-orange-400'
                        : m.role === 'manager' ? 'bg-blue-900/50 text-blue-400'
                        : m.role === 'super_admin' ? 'bg-purple-900/50 text-purple-400'
                        : 'bg-gray-700 text-gray-300'}`}>
                        {m.role === 'admin' ? 'Adhyaksha'
                        : m.role === 'manager' ? 'Khajindar'
                        : m.role === 'collector' ? 'Sevak'
                        : m.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{m.phone}</p>
                  </div>
                  {/* Cannot remove yourself, another admin, or super_admin */}
                  {m.id !== userId && !['admin', 'super_admin'].includes(m.role) && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}