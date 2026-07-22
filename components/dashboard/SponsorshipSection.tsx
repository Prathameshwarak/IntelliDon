'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SPONSOR_PAYMENT_METHODS, PAYMENT_EDIT_WINDOW_MS } from '@/lib/sponsorPaymentMethods'

type EventLite = { id: string; name: string; year: number }

type SponsorPayment = {
  id: string
  amount: number
  received_at: string
  payment_method: string | null
  transaction_id: string | null
  notes: string | null
  created_at: string
}

type SponsorBenefit = {
  id: string
  benefit_name: string
  delivered: boolean
  repetition: string | null
  date_start: string | null
  date_end: string | null
  duration_text: string | null
}

type SponsorType = 'finance' | 'goods_service' | 'ads_package'

type Sponsor = {
  id: string
  event_id: string
  company_name: string
  reference_name: string | null
  contact_person_name: string | null
  contact_person_phone: string | null
  email: string | null
  address: string | null
  gst_no: string | null
  sponsor_type: SponsorType | null
  package: string | null
  package_name: string | null
  committed_amount: number
  contribution_type: 'cash' | 'goods'
  contribution_date: string | null
  contribution_duration: string | null
  weight: string | null
  estimated_value: number | null
  quantity: number | null
  goods_service_description: string | null
  notes: string | null
  amount_received: number
  amount_pending: number
  payment_status: 'pending' | 'partially_paid' | 'completed' | 'n/a'
  payments: SponsorPayment[]
  benefits: SponsorBenefit[]
}

type Props = {
  mandalId: string
  events: EventLite[]
  showToast: (msg: string, type: 'success' | 'error') => void
}

const SPONSOR_TYPES: { value: SponsorType; label: string }[] = [
  { value: 'finance', label: 'Finance' },
  { value: 'goods_service', label: 'Goods/Service' },
  { value: 'ads_package', label: 'Ads Package' }
]
const PACKAGES = [
  { value: 'title', label: 'Title' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'others', label: 'Others' }
]

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-900/50 text-green-400',
  partially_paid: 'bg-yellow-900/50 text-yellow-400',
  pending: 'bg-gray-700 text-gray-300',
  'n/a': 'bg-gray-800 text-gray-500'
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Fully Received',
  partially_paid: 'Partially Received',
  pending: 'Pending',
  'n/a': 'In-kind / Untracked'
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// Only digits, capped at 9 — used for Committed Amount / Quantity / Estimated Value
function onlyDigits9(value: string) {
  const digitsOnly = value.replace(/[^0-9]/g, '')
  return digitsOnly.slice(0, 9)
}

function paymentMethodLabel(value: string | null) {
  if (!value) return 'unspecified'
  return SPONSOR_PAYMENT_METHODS.find(m => m.value === value)?.label || value
}

const emptyForm = {
  event_id: '',
  company_name: '',
  contact_person_name: '',
  contact_person_phone: '',
  email: '',
  address: '',
  gst_no: '',
  reference_name: '',
  sponsor_type: '' as '' | SponsorType,
  // Ads Package-only
  package: '',
  package_name: '',
  // Finance / Ads Package-only
  committed_amount: '',
  contribution_date: '',
  // Goods/Service-only
  goods_service_description: '', // "Goods/Service Name"
  weight: '',
  quantity: '',
  estimated_value: '',
  // Shared
  notes: ''
}

export default function SponsorshipSection({ mandalId, events, showToast }: Props) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [summary, setSummary] = useState({ total_committed: 0, total_received: 0, total_pending: 0 })
  const [loading, setLoading] = useState(true)
  const [eventFilter, setEventFilter] = useState('all')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [showMore, setShowMore] = useState(false) // reveals GST No. + Reference Name

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<'payments' | 'benefits'>('payments')
  const expandedCardRef = useRef<HTMLDivElement | null>(null)

  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [payTxnId, setPayTxnId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Editing an existing sponsor payment (within the 3-hour window)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

  const [benefitName, setBenefitName] = useState('')
  const [benefitRepetition, setBenefitRepetition] = useState('')
  const [benefitStart, setBenefitStart] = useState('')
  const [benefitEnd, setBenefitEnd] = useState('')
  const [benefitSubmitting, setBenefitSubmitting] = useState(false)

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }

  async function fetchSponsors() {
    setLoading(true)
    const headers = await getAuthHeaders()
    const qs = new URLSearchParams({ mandal_id: mandalId })
    if (eventFilter !== 'all') qs.set('event_id', eventFilter)
    const res = await fetch(`/api/sponsors?${qs}`, { headers })
    const data = await res.json()
    if (!data.error) {
      setSponsors(data.sponsors)
      setSummary(data.summary)
    } else {
      showToast(data.error, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { if (mandalId) fetchSponsors() }, [mandalId, eventFilter])

  // ── Auto-close the expanded Payments/Promises card on outside click ──
  useEffect(() => {
    if (!expandedId) return

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (expandedCardRef.current && expandedCardRef.current.contains(target)) return
      setExpandedId(null)
      setEditingPaymentId(null)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [expandedId])

  function resetForm() {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
    setShowMore(false)
  }

  function startEdit(s: Sponsor) {
    setEditingId(s.id)
    setForm({
      event_id: s.event_id,
      company_name: s.company_name,
      contact_person_name: s.contact_person_name || '',
      contact_person_phone: s.contact_person_phone || '',
      email: s.email || '',
      address: s.address || '',
      gst_no: s.gst_no || '',
      reference_name: s.reference_name || '',
      sponsor_type: (s.sponsor_type as SponsorType) || '',
      package: s.package || '',
      package_name: s.package_name || '',
      committed_amount: s.committed_amount ? String(s.committed_amount) : '',
      contribution_date: s.contribution_date || '',
      goods_service_description: s.goods_service_description || '',
      weight: s.weight || '',
      quantity: s.quantity ? String(s.quantity) : '',
      estimated_value: s.estimated_value ? String(s.estimated_value) : '',
      notes: s.notes || ''
    })
    setShowMore(!!(s.gst_no || s.reference_name))
    setShowForm(true)
  }

  function setField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submitSponsorForm() {
    if (!form.event_id) { showToast('Select an event', 'error'); return }
    if (!form.company_name.trim()) { showToast('Sponsor Company/Business/Name is required', 'error'); return }
    if (form.company_name.trim().length > 75) { showToast('Company/Business Name must be 75 characters or fewer', 'error'); return }
    if (form.contact_person_name.trim().length > 50) { showToast('Contact Person must be 50 characters or fewer', 'error'); return }
    if (form.contact_person_phone && !/^[0-9]{10}$/.test(form.contact_person_phone.trim())) {
      showToast('Enter a valid 10-digit phone number', 'error'); return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { showToast('Enter a valid email', 'error'); return }
    if (form.address.trim().length > 100) { showToast('Address must be 100 characters or fewer', 'error'); return }
    if (form.gst_no && !/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$/.test(form.gst_no.trim())) {
      showToast('Enter a valid GST number', 'error'); return
    }
    if (form.reference_name.trim().length > 50) { showToast('Reference Name must be 50 characters or fewer', 'error'); return }
    if (form.notes.trim().length > 100) { showToast('Note must be 100 characters or fewer', 'error'); return }

    if (form.sponsor_type === 'finance' || form.sponsor_type === 'ads_package') {
      if (!form.committed_amount) { showToast('Committed Amount is required', 'error'); return }
      if (!form.contribution_date) { showToast('Date is required', 'error'); return }
    }
    if (form.sponsor_type === 'ads_package') {
      if (!form.package) { showToast('Select a Package Type', 'error'); return }
      if (form.package === 'others' && !form.package_name.trim()) { showToast('Package Name is required', 'error'); return }
      if (form.package_name.trim().length > 75) { showToast('Package Name must be 75 characters or fewer', 'error'); return }
    }
    if (form.sponsor_type === 'goods_service') {
      if (!form.goods_service_description.trim()) { showToast('Goods/Service Name is required', 'error'); return }
      if (form.goods_service_description.trim().length > 75) { showToast('Goods/Service Name must be 75 characters or fewer', 'error'); return }
      if (!form.weight.trim()) { showToast('Weight is required', 'error'); return }
      if (form.weight.trim().length > 10) { showToast('Weight must be 10 characters or fewer', 'error'); return }
      if (!form.quantity) { showToast('Quantity is required', 'error'); return }
    }

    setSubmitting(true)
    const headers = await getAuthHeaders()
    const payload = {
      mandal_id: mandalId,
      event_id: form.event_id,
      company_name: form.company_name.trim(),
      contact_person_name: form.contact_person_name.trim() || null,
      contact_person_phone: form.contact_person_phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      gst_no: form.gst_no.trim() || null,
      reference_name: form.reference_name.trim() || null,
      sponsor_type: form.sponsor_type || null,
      package: form.sponsor_type === 'ads_package' ? (form.package || null) : null,
      package_name: form.sponsor_type === 'ads_package' && form.package === 'others' ? (form.package_name.trim() || null) : null,
      // Finance / Ads Package
      committed_amount: (form.sponsor_type === 'finance' || form.sponsor_type === 'ads_package') && form.committed_amount ? Number(form.committed_amount) : 0,
      contribution_date: (form.sponsor_type === 'finance' || form.sponsor_type === 'ads_package') ? (form.contribution_date || null) : null,
      // Goods/Service
      goods_service_description: form.sponsor_type === 'goods_service' ? (form.goods_service_description.trim() || null) : null,
      weight: form.sponsor_type === 'goods_service' ? (form.weight.trim() || null) : null,
      quantity: form.sponsor_type === 'goods_service' && form.quantity ? Number(form.quantity) : null,
      estimated_value: form.sponsor_type === 'goods_service' && form.estimated_value ? Number(form.estimated_value) : null,
      notes: form.notes.trim() || null
    }

    const res = editingId
      ? await fetch(`/api/sponsors/${editingId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      : await fetch('/api/sponsors', { method: 'POST', headers, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.success) {
      showToast(editingId ? 'Sponsor updated' : 'Sponsor added', 'success')
      resetForm()
      fetchSponsors()
    } else {
      showToast(data.error || 'Could not save sponsor', 'error')
    }
    setSubmitting(false)
  }

  function resetPaymentForm() {
    setPayAmount(''); setPayMethod('cash'); setPayDate(new Date().toISOString().slice(0, 16)); setPayTxnId(''); setPayNotes('')
    setEditingPaymentId(null)
  }

  function toggleExpand(s: Sponsor, panel: 'payments' | 'benefits') {
    if (expandedId === s.id && expandedPanel === panel) {
      setExpandedId(null)
    } else {
      setExpandedId(s.id)
      setExpandedPanel(panel)
      resetPaymentForm()
      setBenefitName(''); setBenefitRepetition(''); setBenefitStart(''); setBenefitEnd('')
    }
  }

  function canEditPayment(p: SponsorPayment) {
    return Date.now() - new Date(p.created_at).getTime() <= PAYMENT_EDIT_WINDOW_MS
  }

  function startEditPayment(p: SponsorPayment) {
    if (!canEditPayment(p)) {
      showToast('This payment can no longer be edited — the 3-hour edit window has passed', 'error')
      return
    }
    setEditingPaymentId(p.id)
    setPayAmount(String(p.amount))
    setPayMethod(p.payment_method || 'cash')
    setPayDate(new Date(p.received_at).toISOString().slice(0, 16))
    setPayTxnId(p.transaction_id || '')
    setPayNotes(p.notes || '')
  }

  async function submitPayment(s: Sponsor) {
    if (!payAmount || Number(payAmount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (s.committed_amount > 0) {
      const otherPaymentsTotal = s.payments
        .filter(p => p.id !== editingPaymentId)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      const pendingForThisEntry = s.committed_amount - otherPaymentsTotal
      if (Number(payAmount) > pendingForThisEntry + 0.01) {
        showToast(`Amount exceeds pending balance of ${formatMoney(pendingForThisEntry)}`, 'error'); return
      }
    }
    setPaySubmitting(true)
    const headers = await getAuthHeaders()
    const body = JSON.stringify({
      amount: Number(payAmount),
      received_at: new Date(payDate).toISOString(),
      payment_method: payMethod,
      transaction_id: payTxnId.trim() || null,
      notes: payNotes.trim() || null
    })

    const res = editingPaymentId
      ? await fetch(`/api/sponsors/payments/${editingPaymentId}`, { method: 'PATCH', headers, body })
      : await fetch(`/api/sponsors/${s.id}/payments`, { method: 'POST', headers, body })
    const data = await res.json()
    if (data.success) {
      showToast(editingPaymentId ? 'Payment updated' : 'Payment recorded', 'success')
      resetPaymentForm()
      fetchSponsors()
    } else showToast(data.error || 'Could not save payment', 'error')
    setPaySubmitting(false)
  }

  async function submitBenefit(s: Sponsor) {
    if (!benefitName.trim()) { showToast('Benefit name is required', 'error'); return }
    if (benefitStart && benefitEnd && benefitEnd < benefitStart) { showToast('End date cannot be before start date', 'error'); return }
    setBenefitSubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors/${s.id}/benefits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        benefit_name: benefitName.trim(),
        repetition: benefitRepetition.trim() || null,
        date_start: benefitStart || null,
        date_end: benefitEnd || null
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Promise added', 'success')
      setBenefitName(''); setBenefitRepetition(''); setBenefitStart(''); setBenefitEnd('')
      fetchSponsors()
    } else showToast(data.error || 'Could not add promise', 'error')
    setBenefitSubmitting(false)
  }

  async function toggleDelivered(benefit: SponsorBenefit) {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors/benefits/${benefit.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ delivered: !benefit.delivered })
    })
    const data = await res.json()
    if (data.success) fetchSponsors()
    else showToast(data.error || 'Could not update promise', 'error')
  }

  async function deleteBenefit(benefitId: string) {
    if (!confirm('Remove this promised benefit?')) return
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors/benefits/${benefitId}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (data.success) { showToast('Promise removed', 'success'); fetchSponsors() }
    else showToast(data.error || 'Could not remove promise', 'error')
  }

  function durationRemainingLabel(b: SponsorBenefit) {
    if (b.delivered) return 'Delivered'
    if (!b.date_end) return b.duration_text || '—'
    const days = Math.ceil((new Date(b.date_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Overdue'
    if (days === 0) return 'Due today'
    return `${days} day${days !== 1 ? 's' : ''} left`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">Committed</p>
          <p className="text-sm font-semibold text-white mt-1">{formatMoney(summary.total_committed)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">Received</p>
          <p className="text-sm font-semibold text-green-400 mt-1">{formatMoney(summary.total_received)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">Pending</p>
          <p className="text-sm font-semibold text-orange-400 mt-1">{formatMoney(summary.total_pending)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
          <option value="all">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.year}</option>)}
        </select>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {showForm ? 'Close Form' : '+ Add Sponsor'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-white">{editingId ? 'Edit Sponsor' : 'New Sponsor'}</p>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Event</label>
            <select value={form.event_id} onChange={e => setField('event_id', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
              <option value="">Select event</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.year}</option>)}
            </select>
          </div>

          {/* Details */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Details</p>
          <input value={form.company_name} onChange={e => setField('company_name', e.target.value.slice(0, 75))} placeholder="Sponsor Company / Business / Name"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.contact_person_name} onChange={e => setField('contact_person_name', e.target.value.slice(0, 50))} placeholder="Contact person name (optional)"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            <input value={form.contact_person_phone} onChange={e => setField('contact_person_phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="Contact phone (optional)" type="tel" inputMode="numeric"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          </div>
          <input value={form.email} onChange={e => setField('email', e.target.value)} placeholder="Email (optional)" type="email"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input value={form.address} onChange={e => setField('address', e.target.value.slice(0, 100))} placeholder="Address (optional)"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />

          {!showMore ? (
            <button type="button" onClick={() => setShowMore(true)} className="text-xs text-orange-400 hover:text-orange-300 font-medium self-start">
              + More
            </button>
          ) : (
            <>
              <input value={form.gst_no} onChange={e => setField('gst_no', e.target.value.toUpperCase().slice(0, 15))} placeholder="GST No. (optional)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <input value={form.reference_name} onChange={e => setField('reference_name', e.target.value.slice(0, 50))} placeholder="Sponsor Reference Name (optional)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <button type="button" onClick={() => setShowMore(false)} className="text-xs text-gray-500 hover:text-gray-300 font-medium self-start">
                − Less
              </button>
            </>
          )}

          {/* Sponsor Type dropdown */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Sponsor Type</p>
          <select
            value={form.sponsor_type}
            onChange={e => setField('sponsor_type', e.target.value as '' | SponsorType)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="">Select sponsor type</option>
            {SPONSOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Finance-only fields */}
          {form.sponsor_type === 'finance' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Finance Details</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.committed_amount} onChange={e => setField('committed_amount', onlyDigits9(e.target.value))}
                  type="text" inputMode="numeric" maxLength={9} placeholder="Committed Amount (₹)"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={form.contribution_date} onChange={e => setField('contribution_date', e.target.value)} type="date" placeholder="Date"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
              </div>
            </>
          )}

          {/* Goods/Service-only fields */}
          {form.sponsor_type === 'goods_service' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Goods / Service Details</p>
              <input value={form.goods_service_description} onChange={e => setField('goods_service_description', e.target.value.slice(0, 75))} placeholder="Goods/Service Name"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.weight} onChange={e => setField('weight', e.target.value.slice(0, 10))} placeholder="Weight"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={form.quantity} onChange={e => setField('quantity', onlyDigits9(e.target.value))} type="text" inputMode="numeric" maxLength={9} placeholder="Quantity"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              </div>
              <input value={form.estimated_value} onChange={e => setField('estimated_value', onlyDigits9(e.target.value))} type="text" inputMode="numeric" maxLength={9} placeholder="Estimated Value (₹) (optional)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            </>
          )}

          {/* Ads Package-only fields */}
          {form.sponsor_type === 'ads_package' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Ads Package Details</p>
              <select value={form.package} onChange={e => setField('package', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
                <option value="">Select package type</option>
                {PACKAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {form.package === 'others' && (
                <input value={form.package_name} onChange={e => setField('package_name', e.target.value.slice(0, 75))} placeholder="Package Name"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              )}
              <div className="grid grid-cols-2 gap-2">
                <input value={form.committed_amount} onChange={e => setField('committed_amount', onlyDigits9(e.target.value))}
                  type="text" inputMode="numeric" maxLength={9} placeholder="Committed Amount (₹)"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={form.contribution_date} onChange={e => setField('contribution_date', e.target.value)} type="date" placeholder="Date"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
              </div>
            </>
          )}

          {form.sponsor_type && (
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value.slice(0, 100))} placeholder="Note (optional)" rows={2}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none" />
          )}

          <div className="flex gap-2">
            <button onClick={submitSponsorForm} disabled={submitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Sponsor'}
            </button>
            <button onClick={resetForm} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm text-center py-8">Loading sponsors...</p>
      ) : sponsors.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No sponsors added yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sponsors.map(s => {
            const isExpanded = expandedId === s.id
            const displayPackage = s.package === 'others' ? (s.package_name || 'Others') : s.package
            return (
            <div key={s.id} ref={isExpanded ? expandedCardRef : undefined} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{s.company_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[s.payment_status]}`}>
                      {STATUS_LABELS[s.payment_status]}
                    </span>
                    {displayPackage && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-900/50 text-purple-300 capitalize">
                        {displayPackage}
                      </span>
                    )}
                    {s.sponsor_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-900/50 text-blue-300">
                        {SPONSOR_TYPES.find(t => t.value === s.sponsor_type)?.label || s.sponsor_type}
                      </span>
                    )}
                  </div>
                  {(s.contact_person_name || s.contact_person_phone) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {s.contact_person_name}{s.contact_person_name && s.contact_person_phone ? ' · ' : ''}{s.contact_person_phone}
                    </p>
                  )}
                  {events.find(ev => ev.id === s.event_id) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {events.find(ev => ev.id === s.event_id)!.name} {events.find(ev => ev.id === s.event_id)!.year}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">{formatMoney(s.committed_amount)}</p>
                  <p className="text-[11px] text-green-400">Received: {formatMoney(s.amount_received)}</p>
                  {s.amount_pending > 0 && <p className="text-[11px] text-orange-400">Due: {formatMoney(s.amount_pending)}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button onClick={() => toggleExpand(s, 'payments')} className="text-xs text-orange-400 hover:text-orange-300 font-medium">
                  {isExpanded && expandedPanel === 'payments' ? 'Hide payments' : `Payments (${s.payments.length})`}
                </button>
                <button onClick={() => toggleExpand(s, 'benefits')} className="text-xs text-purple-400 hover:text-purple-300 font-medium">
                  {isExpanded && expandedPanel === 'benefits' ? 'Hide promises' : `Promises (${s.benefits.length})`}
                </button>
                <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-white font-medium ml-auto">Edit</button>
              </div>

              {/* Payments panel */}
              {isExpanded && expandedPanel === 'payments' && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
                  {s.payments.length === 0 && <p className="text-xs text-gray-500">No payments recorded yet.</p>}
                  {s.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-white font-medium">
                          {formatMoney(p.amount)} <span className="text-gray-500 font-normal">· {paymentMethodLabel(p.payment_method)}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {new Date(p.received_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {p.transaction_id ? ` · Txn: ${p.transaction_id}` : ''}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      {canEditPayment(p) && (
                        <button onClick={() => startEditPayment(p)} className="text-[11px] text-orange-400/80 hover:text-orange-400">Edit</button>
                      )}
                    </div>
                  ))}

                  {(s.committed_amount === 0 || s.amount_pending > 0 || editingPaymentId) && (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mt-1 flex flex-col gap-2">
                      <p className="text-xs font-medium text-gray-300">
                        {editingPaymentId ? 'Edit payment' : 'Record a payment (installment)'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" min="0" step="0.01"
                          placeholder={s.committed_amount > 0 ? `Amount (up to ${formatMoney(s.amount_pending)})` : 'Amount'}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
                          {SPONSOR_PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                      <input value={payDate} onChange={e => setPayDate(e.target.value)} type="datetime-local"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
                      <input value={payTxnId} onChange={e => setPayTxnId(e.target.value)} placeholder="Transaction ID (optional)"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                      <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Notes (optional)"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                      <div className="flex gap-2">
                        <button onClick={() => submitPayment(s)} disabled={paySubmitting}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg">
                          {paySubmitting ? 'Saving...' : editingPaymentId ? 'Save Changes' : 'Record Payment'}
                        </button>
                        {editingPaymentId && (
                          <button onClick={resetPaymentForm} className="px-3 bg-gray-800 text-gray-300 text-xs rounded-lg">Cancel</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Promises panel */}
              {isExpanded && expandedPanel === 'benefits' && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
                  {s.benefits.length === 0 && <p className="text-xs text-gray-500">No promised benefits added yet.</p>}
                  {s.benefits.map(b => (
                    <div key={b.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-white font-medium">{b.benefit_name}</p>
                        <p className="text-[11px] text-gray-500">
                          {b.repetition ? `${b.repetition} · ` : ''}
                          {b.date_start ? new Date(b.date_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          {b.date_start && b.date_end ? ' – ' : ''}
                          {b.date_end ? new Date(b.date_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          {(b.date_start || b.date_end) ? ' · ' : ''}
                          {durationRemainingLabel(b)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleDelivered(b)}
                        className={`text-[11px] px-2 py-1 rounded-lg font-semibold shrink-0 ${
                          b.delivered ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {b.delivered ? 'Delivered ✓' : 'Mark Delivered'}
                      </button>
                      <button onClick={() => deleteBenefit(b.id)} className="text-[11px] text-red-400/70 hover:text-red-400 shrink-0">Remove</button>
                    </div>
                  ))}

                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mt-1 flex flex-col gap-2">
                    <p className="text-xs font-medium text-gray-300">Add a promised benefit</p>
                    <input value={benefitName} onChange={e => setBenefitName(e.target.value)} placeholder="Benefit name (e.g. Banner, Logo, Stall Space)"
                      className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                    <input value={benefitRepetition} onChange={e => setBenefitRepetition(e.target.value)} placeholder="Repetition (e.g. 3x per day, optional)"
                      className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={benefitStart} onChange={e => setBenefitStart(e.target.value)} type="date"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
                      <input value={benefitEnd} onChange={e => setBenefitEnd(e.target.value)} type="date"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
                    </div>
                    <button onClick={() => submitBenefit(s)} disabled={benefitSubmitting}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg">
                      {benefitSubmitting ? 'Adding...' : 'Add Promise'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
