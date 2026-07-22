'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type EventLite = { id: string; name: string; year: number }

type SponsorPayment = {
  id: string
  amount: number
  received_at: string
  payment_method: string | null
  transaction_id: string | null
  notes: string | null
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
  sponsor_type: 'finance' | 'goods_service' | null
  package: string | null
  committed_amount: number
  contribution_type: 'cash' | 'goods'
  contribution_date: string | null
  contribution_duration: string | null
  payment_method: string | null
  transaction_id: string | null
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

const SPONSOR_TYPES = [
  { value: 'finance', label: 'Finance' },
  { value: 'goods_service', label: 'Goods/Service' }
]
const PACKAGES = [
  { value: 'title', label: 'Title' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'supporting', label: 'Supporting' }
]
// Finance sponsor contribution payment method (distinct from the
// installment-recording payment method further down, which keeps
// its broader list of options for actually receiving money later)
const FINANCE_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }
]
const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'goods', 'service', 'other']

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

const emptyForm = {
  event_id: '',
  company_name: '',
  contact_person_name: '',
  contact_person_phone: '',
  email: '',
  address: '',
  gst_no: '',
  reference_name: '',       // moved: now appears after GST No. in the form
  sponsor_type: '' as '' | 'finance' | 'goods_service',
  package: '',
  // Finance-only fields
  committed_amount: '',
  contribution_date: '',
  payment_method: '',
  transaction_id: '',
  // Goods/Service-only fields
  goods_service_description: '', // "Goods/Service Name"
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

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<'payments' | 'benefits'>('payments')

  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [payTxnId, setPayTxnId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

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

  function resetForm() {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
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
      sponsor_type: (s.sponsor_type as 'finance' | 'goods_service') || '',
      package: s.package || '',
      committed_amount: s.committed_amount ? String(s.committed_amount) : '',
      contribution_date: s.contribution_date || '',
      payment_method: s.payment_method || '',
      transaction_id: s.transaction_id || '',
      goods_service_description: s.goods_service_description || '',
      quantity: s.quantity ? String(s.quantity) : '',
      estimated_value: s.estimated_value ? String(s.estimated_value) : '',
      notes: s.notes || ''
    })
    setShowForm(true)
  }

  function setField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submitSponsorForm() {
    if (!form.event_id) { showToast('Select an event', 'error'); return }
    if (!form.company_name.trim()) { showToast('Sponsor Company/Business/Name is required', 'error'); return }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { showToast('Enter a valid email', 'error'); return }
    if (form.contact_person_phone && !/^[0-9+\-\s()]{7,15}$/.test(form.contact_person_phone)) { showToast('Enter a valid phone number', 'error'); return }
    if (form.sponsor_type === 'finance' && form.committed_amount && Number(form.committed_amount) < 0) {
      showToast('Committed amount cannot be negative', 'error'); return
    }
    if (form.sponsor_type === 'goods_service' && form.quantity && Number(form.quantity) < 0) {
      showToast('Quantity cannot be negative', 'error'); return
    }
    if (form.sponsor_type === 'goods_service' && form.estimated_value && Number(form.estimated_value) < 0) {
      showToast('Estimated value cannot be negative', 'error'); return
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
      package: form.package || null,
      // Finance-only
      committed_amount: form.sponsor_type === 'finance' && form.committed_amount ? Number(form.committed_amount) : 0,
      contribution_date: form.sponsor_type === 'finance' ? (form.contribution_date || null) : null,
      payment_method: form.sponsor_type === 'finance' ? (form.payment_method.trim() || null) : null,
      transaction_id: form.sponsor_type === 'finance' ? (form.transaction_id.trim() || null) : null,
      // Goods/Service-only
      goods_service_description: form.sponsor_type === 'goods_service' ? (form.goods_service_description.trim() || null) : null,
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


  function toggleExpand(s: Sponsor, panel: 'payments' | 'benefits') {
    if (expandedId === s.id && expandedPanel === panel) {
      setExpandedId(null)
    } else {
      setExpandedId(s.id)
      setExpandedPanel(panel)
      setPayAmount(''); setPayMethod('cash'); setPayDate(new Date().toISOString().slice(0, 16)); setPayTxnId(''); setPayNotes('')
      setBenefitName(''); setBenefitRepetition(''); setBenefitStart(''); setBenefitEnd('')
    }
  }

  async function submitPayment(s: Sponsor) {
    if (!payAmount || Number(payAmount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (s.committed_amount > 0 && Number(payAmount) > s.amount_pending + 0.01) {
      showToast(`Amount exceeds pending balance of ${formatMoney(s.amount_pending)}`, 'error'); return
    }
    setPaySubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors/${s.id}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: Number(payAmount),
        received_at: new Date(payDate).toISOString(),
        payment_method: payMethod,
        transaction_id: payTxnId.trim() || null,
        notes: payNotes.trim() || null
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Payment recorded', 'success')
      setPayAmount(''); setPayTxnId(''); setPayNotes('')
      fetchSponsors()
    } else showToast(data.error || 'Could not record payment', 'error')
    setPaySubmitting(false)
  }

  async function deletePayment(paymentId: string) {
    if (!confirm('Remove this payment entry?')) return
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors/payments/${paymentId}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (data.success) { showToast('Payment removed', 'success'); fetchSponsors() }
    else showToast(data.error || 'Could not remove payment', 'error')
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
            <label className="text-xs text-gray-400 mb-1 block">Event *</label>
            <select value={form.event_id} onChange={e => setField('event_id', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
              <option value="">Select event</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.year}</option>)}
            </select>
          </div>

          {/* Details */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Details</p>
          <input value={form.company_name} onChange={e => setField('company_name', e.target.value)} placeholder="Sponsor Company / Business / Name *"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.contact_person_name} onChange={e => setField('contact_person_name', e.target.value)} placeholder="Contact person name"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            <input value={form.contact_person_phone} onChange={e => setField('contact_person_phone', e.target.value)} placeholder="Contact phone" type="tel"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          </div>
          <input value={form.email} onChange={e => setField('email', e.target.value)} placeholder="Email" type="email"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Address"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input value={form.gst_no} onChange={e => setField('gst_no', e.target.value)} placeholder="GST No. (optional)"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
          <input value={form.reference_name} onChange={e => setField('reference_name', e.target.value)} placeholder="Sponsor Reference Name (optional)"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />

          {/* Type + Package */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Sponsor Type</p>
          <div className="grid grid-cols-2 gap-2">
            {SPONSOR_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setField('sponsor_type', form.sponsor_type === t.value ? '' : t.value as 'finance' | 'goods_service')}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors
                  ${form.sponsor_type === t.value ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Sponsor Package (optional)</p>
          <div className="grid grid-cols-3 gap-2">
            {PACKAGES.map(p => (
              <button key={p.value} type="button" onClick={() => setField('package', form.package === p.value ? '' : p.value)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors
                  ${form.package === p.value ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Finance-only fields */}
          {form.sponsor_type === 'finance' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Finance Details</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.committed_amount} onChange={e => setField('committed_amount', e.target.value)} type="number" min="0" step="0.01"
                  placeholder="Committed Amount (₹)"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={form.contribution_date} onChange={e => setField('contribution_date', e.target.value)} type="date" placeholder="Date"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {FINANCE_PAYMENT_METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setField('payment_method', form.payment_method === m.value ? '' : m.value)}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors
                        ${form.payment_method === m.value ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <input value={form.transaction_id} onChange={e => setField('transaction_id', e.target.value)}
                placeholder={form.payment_method === 'cheque' ? 'Cheque No.' : 'Transaction ID'}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            </>
          )}

          {/* Goods/Service-only fields */}
          {form.sponsor_type === 'goods_service' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Goods / Service Details</p>
              <input value={form.goods_service_description} onChange={e => setField('goods_service_description', e.target.value)} placeholder="Goods/Service Name"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.quantity} onChange={e => setField('quantity', e.target.value)} type="number" min="0" step="1" placeholder="Quantity"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={form.estimated_value} onChange={e => setField('estimated_value', e.target.value)} type="number" min="0" step="0.01" placeholder="Estimated Value (₹)"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              </div>
            </>
          )}

          {form.sponsor_type && (
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes (optional)" rows={2}
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
          {sponsors.map(s => (
            <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{s.company_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[s.payment_status]}`}>
                      {STATUS_LABELS[s.payment_status]}
                    </span>
                    {s.package && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-900/50 text-purple-300 capitalize">
                        {s.package}
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
                  {expandedId === s.id && expandedPanel === 'payments' ? 'Hide payments' : `Payments (${s.payments.length})`}
                </button>
                <button onClick={() => toggleExpand(s, 'benefits')} className="text-xs text-purple-400 hover:text-purple-300 font-medium">
                  {expandedId === s.id && expandedPanel === 'benefits' ? 'Hide promises' : `Promises (${s.benefits.length})`}
                </button>
                <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-white font-medium ml-auto">Edit</button>
              </div>

              {/* Payments panel */}
              {expandedId === s.id && expandedPanel === 'payments' && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-2">
                  {s.payments.length === 0 && <p className="text-xs text-gray-500">No payments recorded yet.</p>}
                  {s.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-white font-medium">
                          {formatMoney(p.amount)} <span className="text-gray-500 font-normal">· {p.payment_method || 'unspecified'}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {new Date(p.received_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {p.transaction_id ? ` · Txn: ${p.transaction_id}` : ''}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      <button onClick={() => deletePayment(p.id)} className="text-[11px] text-red-400/70 hover:text-red-400">Remove</button>
                    </div>
                  ))}

                  {(s.committed_amount === 0 || s.amount_pending > 0) && (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mt-1 flex flex-col gap-2">
                      <p className="text-xs font-medium text-gray-300">Record a payment (installment)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={payAmount} onChange={e => setPayAmount(e.target.value)} type="number" min="0" step="0.01"
                          placeholder={s.committed_amount > 0 ? `Amount (up to ${formatMoney(s.amount_pending)})` : 'Amount'}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                          className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <input value={payDate} onChange={e => setPayDate(e.target.value)} type="datetime-local"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
                      <input value={payTxnId} onChange={e => setPayTxnId(e.target.value)} placeholder="Transaction ID (optional)"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                      <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Notes (optional)"
                        className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
                      <button onClick={() => submitPayment(s)} disabled={paySubmitting}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg">
                        {paySubmitting ? 'Recording...' : 'Record Payment'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Promises panel */}
              {expandedId === s.id && expandedPanel === 'benefits' && (
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
          ))}
        </div>
      )}
    </div>
  )
}
