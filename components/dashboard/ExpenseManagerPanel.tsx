'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadExpenseReport, shareExpenseReport, type ExpenseReportRow } from '@/lib/downloadExpenseReport'
import { FloatingInput, FloatingTextarea, FloatingSelect } from './FloatingField'
import {
  EXPENSE_PAYMENT_MODES, expensePaymentModeLabel, EXPENSE_PAYMENT_EDIT_WINDOW_MS,
  EXPENSE_AMOUNT_REGEX, formatExpenseAmount
} from '@/lib/expensePaymentModes'
import ExpenseDetailModal, { type ExpenseDetail, type ExpensePayment } from './ExpenseDetailModal'

type Expense = ExpenseReportRow & {
  id: string
  amount_pending: number
  payment_status: 'pending' | 'partially_paid' | 'completed'
}

type Props = {
  mandalId: string
  eventId: string
  eventLabel: string
  eventExpired: boolean
  showToast: (msg: string, type: 'success' | 'error') => void
  onBack: () => void
}

type SortOption = 'az' | 'za' | 'date_asc' | 'date_desc'

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-green-400 border border-emerald-500/20',
  partially_paid: 'bg-amber-500/10 text-amber-600 dark:text-yellow-400 border border-amber-500/20',
  pending: 'bg-rose-500/10 text-rose-600 dark:text-red-400 border border-rose-500/20'
}
const STATUS_LABELS: Record<string, string> = {
  completed: 'Fully Recorded',
  partially_paid: 'Partially Recorded',
  pending: 'Pending'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Matches the attached share/export icon (arrow up into an open tray)
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

const emptyForm = {
  expense_date: new Date().toISOString().split('T')[0],
  vendor_name: '',
  vendor_phone: '',
  title: '',
  description: '',
  amount: ''
}

export default function ExpenseManagerPanel({ mandalId, eventId, eventLabel, eventExpired, showToast, onBack }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  // ── Search + Sort ──────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('date_asc')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // ── Add Expense modal ──────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)

  // ── Payment recording (popup, same style as the View popup) ──
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('cash')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [payTxnId, setPayTxnId] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)

  // Which format-choice popover is open, if any
  const [openMenu, setOpenMenu] = useState<'download' | null>(null)
  const [exporting, setExporting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }

  async function fetchExpenses() {
    setLoading(true)
    const headers = await getAuthHeaders()
    const qs = new URLSearchParams({ event_id: eventId, mandal_id: mandalId })
    const res = await fetch(`/api/expenses?${qs}`, { headers })
    const data = await res.json()
    if (!data.error) {
      setExpenses(data.expenses)
      setSummary(data.summary)
    } else {
      showToast(data.error, 'error')
    }
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [eventId])

  // Close the download format popover on an outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  // Close the sort/filter popover on an outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    if (filterOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterOpen])

  // Search by Title or Vendor Name, then apply the single active sort option
  // (A–Z / Z–A / Date Ascending / Date Descending are mutually exclusive —
  // one shared state means picking any option automatically clears the rest).
  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = !query
      ? expenses
      : expenses.filter(e => e.title.toLowerCase().includes(query) || e.vendor_name.toLowerCase().includes(query))

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'az': return a.title.localeCompare(b.title)
        case 'za': return b.title.localeCompare(a.title)
        case 'date_desc': return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
        case 'date_asc':
        default: return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
      }
    })
  }, [expenses, search, sortOption])

  function setField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setShowAddModal(false)
  }

  function validate(): string | null {
    if (!form.expense_date) return 'Expense date is required'
    if (!form.vendor_name.trim()) return 'Vendor name is required'
    if (form.vendor_name.trim().length > 50) return 'Vendor name must be 50 characters or fewer'
    if (form.vendor_phone && !/^[0-9]{10}$/.test(form.vendor_phone.trim())) return 'Vendor phone must be exactly 10 digits'
    if (!form.title.trim()) return 'Title is required'
    if (form.title.trim().length > 75) return 'Title must be 75 characters or fewer'
    if (form.description && form.description.trim().length > 500) return 'Description must be 500 characters or fewer'
    if (!form.amount || Number(form.amount) <= 0) return 'Enter a valid estimated amount'
    if (String(Math.floor(Number(form.amount))).length > 9) return 'Estimated amount cannot exceed 9 digits'
    if (!EXPENSE_AMOUNT_REGEX.test(form.amount.trim())) return 'Estimated amount can have at most 2 decimal places'
    return null
  }

  async function submitExpenseForm() {
    if (eventExpired) { showToast('The 30-day window for this event has closed — expenses can no longer be added', 'error'); return }
    const validationError = validate()
    if (validationError) { showToast(validationError, 'error'); return }

    setSubmitting(true)
    const headers = await getAuthHeaders()
    const payload = {
      mandal_id: mandalId,
      event_id: eventId,
      expense_date: form.expense_date,
      vendor_name: form.vendor_name.trim(),
      vendor_phone: form.vendor_phone.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount)
    }
    const res = await fetch('/api/expenses', { method: 'POST', headers, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.success) {
      showToast('Expense added', 'success')
      resetForm()
      fetchExpenses()
    } else {
      showToast(data.error || 'Could not save expense', 'error')
    }
    setSubmitting(false)
  }

  async function handleExport(action: 'download' | 'share', format: 'pdf' | 'excel') {
    setOpenMenu(null)
    if (expenses.length === 0) { showToast('No expenses to export', 'error'); return }
    setExporting(true)
    try {
      if (action === 'download') {
        await downloadExpenseReport(format, eventLabel, expenses, { total_amount: summary.total_amount, total_paid: summary.total_paid, count: summary.count })
      } else {
        await shareExpenseReport(format, eventLabel, expenses, { total_amount: summary.total_amount, total_paid: summary.total_paid, count: summary.count })
      }
    } catch (err) {
      console.error(err)
      showToast('Could not export the report', 'error')
    }
    setExporting(false)
  }

  function resetPaymentForm() {
    setPayAmount(''); setPayMode('cash'); setPayDate(new Date().toISOString().slice(0, 16)); setPayTxnId(''); setPayNotes('')
    setEditingPaymentId(null)
  }

  function openPaymentModal(exp: Expense) {
    if (eventExpired) { showToast('The 30-day window for this event has closed — payments can no longer be recorded', 'error'); return }
    resetPaymentForm()
    setExpandedId(exp.id)
  }

  function closePaymentModal() {
    setExpandedId(null)
    resetPaymentForm()
  }

  function canEditPayment(p: ExpensePayment) {
    return Date.now() - new Date(p.created_at).getTime() <= EXPENSE_PAYMENT_EDIT_WINDOW_MS
  }

  function startEditPayment(p: ExpensePayment) {
    if (!canEditPayment(p)) {
      showToast('This payment can no longer be edited — the 3-hour edit window has passed', 'error')
      return
    }
    setEditingPaymentId(p.id)
    setPayAmount(String(p.amount))
    setPayMode(p.payment_mode || 'cash')
    setPayDate(new Date(p.paid_at).toISOString().slice(0, 16))
    setPayTxnId(p.transaction_id || '')
    setPayNotes(p.notes || '')
  }

  async function submitPayment(exp: Expense) {
    if (eventExpired) { showToast('The 30-day window for this event has closed — payments can no longer be recorded', 'error'); return }
    if (!payAmount || Number(payAmount) <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (!EXPENSE_AMOUNT_REGEX.test(payAmount.trim())) { showToast('Amount can have at most 2 decimal places', 'error'); return }

    const otherPaymentsTotal = exp.payments
      .filter(p => p.id !== editingPaymentId)
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const pendingForThisEntry = exp.amount - otherPaymentsTotal
    if (Number(payAmount) > pendingForThisEntry + 0.01) {
      showToast(`Amount exceeds remaining balance of ${formatExpenseAmount(pendingForThisEntry)}`, 'error'); return
    }
    if (payTxnId.trim() && !/^[A-Za-z0-9]+$/.test(payTxnId.trim())) {
      showToast('Transaction ID must be alphanumeric', 'error'); return
    }
    if (payTxnId.trim().length > 25) { showToast('Transaction ID must be 25 characters or fewer', 'error'); return }

    setPaySubmitting(true)
    const headers = await getAuthHeaders()
    const body = JSON.stringify({
      amount: Number(payAmount),
      paid_at: new Date(payDate).toISOString(),
      payment_mode: payMode,
      transaction_id: payTxnId.trim() || null,
      notes: payNotes.trim() || null
    })

    const res = editingPaymentId
      ? await fetch(`/api/expenses/payments/${editingPaymentId}`, { method: 'PATCH', headers, body })
      : await fetch(`/api/expenses/${exp.id}/payments`, { method: 'POST', headers, body })
    const data = await res.json()
    if (data.success) {
      showToast(editingPaymentId ? 'Payment updated' : 'Payment recorded', 'success')
      resetPaymentForm()
      fetchExpenses()
    } else {
      showToast(data.error || 'Could not save payment', 'error')
    }
    setPaySubmitting(false)
  }

  const sortOptionLabel: Record<SortOption, string> = {
    az: 'A → Z',
    za: 'Z → A',
    date_asc: 'Date Ascending',
    date_desc: 'Date Descending'
  }

  function filterOptionClass(active: boolean) {
    return `w-full text-left text-xs px-3 py-2 rounded-lg font-bold cursor-pointer transition-colors flex items-center justify-between ${
      active
        ? 'bg-[#E8650A]/10 text-[#E8650A] dark:bg-orange-400/10 dark:text-orange-400'
        : 'text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800'
    }`
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold transition-colors cursor-pointer flex items-center gap-1"
      >
        ← Back to Events List
      </button>

      <div>
        <h3 className="text-base font-bold text-[#1A1208] dark:text-white">Expense Management</h3>
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">{eventLabel}</p>
      </div>

      {eventExpired && (
        <div className="bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
          <span className="text-amber-600 dark:text-amber-400 text-sm font-bold shrink-0">📌</span>
          <div>The 30-day window to add, edit, or record payments for this event has closed. Expenses are now <strong>view-only</strong> — you can still search, filter, and download records.</div>
        </div>
      )}

      {/* Summary — 3 grid boxes: Entries, Total Expense, Recorded Expense */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-400 font-bold">Entries</p>
          <p className="text-sm font-bold text-[#1A1208] dark:text-white mt-1">{summary.count}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-400 font-bold">Total Expense</p>
          <p className="text-sm font-bold text-[#1A1208] dark:text-white mt-1 truncate">{formatExpenseAmount(summary.total_amount)}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-400 font-bold">Recorded Expense</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-green-400 mt-1 truncate">{formatExpenseAmount(summary.total_paid)}</p>
        </div>
      </div>

      {/* Search (top-left) + Add / Filter / Download & Share (top-right), same row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            placeholder="Search by title or vendor name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
          />
          <span className="absolute left-3 top-2 text-[#7a6a55] dark:text-gray-500 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {!eventExpired && (
            <button
              onClick={() => setShowAddModal(true)}
              title="Add expense"
              aria-label="Add expense"
              className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white rounded-xl font-bold cursor-pointer transition-all shadow-md shadow-[#E8650A]/20 text-2xl leading-none"
            >
              +
            </button>
          )}

          <div ref={filterRef} className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              title="Sort / filter"
              aria-label="Sort / filter"
              className="w-10 h-10 flex items-center justify-center bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl font-bold cursor-pointer transition-colors shadow-sm text-base"
            >
              ⚙️
            </button>

            {filterOpen && (
              <div className="absolute z-20 top-full mt-1 right-0 w-56 bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-0.5">
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold px-3 pt-1 pb-1">Sort by Title</p>
                <button onClick={() => { setSortOption('az'); setFilterOpen(false) }} className={filterOptionClass(sortOption === 'az')}>
                  A → Z {sortOption === 'az' && '✓'}
                </button>
                <button onClick={() => { setSortOption('za'); setFilterOpen(false) }} className={filterOptionClass(sortOption === 'za')}>
                  Z → A {sortOption === 'za' && '✓'}
                </button>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold px-3 pt-2 pb-1 border-t border-[#1A1208]/10 dark:border-gray-800 mt-1">Sort by Date</p>
                <button onClick={() => { setSortOption('date_asc'); setFilterOpen(false) }} className={filterOptionClass(sortOption === 'date_asc')}>
                  Date Ascending {sortOption === 'date_asc' && '✓'}
                </button>
                <button onClick={() => { setSortOption('date_desc'); setFilterOpen(false) }} className={filterOptionClass(sortOption === 'date_desc')}>
                  Date Descending {sortOption === 'date_desc' && '✓'}
                </button>
              </div>
            )}
          </div>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'download' ? null : 'download')}
              disabled={exporting}
              title="Download or share report"
              aria-label="Download or share report"
              className="w-10 h-10 flex items-center justify-center bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl font-bold disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
            >
              <ShareIcon className="w-4 h-4" />
            </button>

            {openMenu === 'download' && (
              <div className="absolute z-20 top-full mt-1 right-0 w-48 bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold px-3 pt-2 pb-1">Download</p>
                <button onClick={() => handleExport('download', 'pdf')} className="w-full text-left text-xs text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 px-3 py-2 cursor-pointer font-bold">
                  📄 PDF
                </button>
                <button onClick={() => handleExport('download', 'excel')} className="w-full text-left text-xs text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 px-3 py-2 cursor-pointer font-bold">
                  📊 Excel
                </button>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold px-3 pt-2 pb-1 border-t border-[#1A1208]/10 dark:border-gray-800">Share</p>
                <button onClick={() => handleExport('share', 'pdf')} className="w-full text-left text-xs text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 px-3 py-2 cursor-pointer font-bold">
                  📄 PDF
                </button>
                <button onClick={() => handleExport('share', 'excel')} className="w-full text-left text-xs text-[#1A1208] dark:text-gray-200 hover:bg-[#F5EDE2] dark:hover:bg-gray-800 px-3 py-2 cursor-pointer font-bold">
                  📊 Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-[#7a6a55] dark:text-gray-500 font-bold -mt-2">Sorted by: {sortOptionLabel[sortOption]}</p>

      {loading ? (
        <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-8 font-medium">Loading expenses...</p>
      ) : expenses.length === 0 ? (
        <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-8 font-medium">No expenses recorded for this event.</p>
      ) : visibleExpenses.length === 0 ? (
        <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-8 font-medium">No expenses match your search.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleExpenses.map(exp => {
            return (
              <div
                key={exp.id}
                className="bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#1A1208] dark:text-white">{exp.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_STYLES[exp.payment_status]}`}>
                        {STATUS_LABELS[exp.payment_status]}
                      </span>
                    </div>
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">
                      {exp.vendor_name}{exp.vendor_phone ? ` · ${exp.vendor_phone}` : ''}
                    </p>
                    <p className="text-xs text-[#7a6a55] dark:text-gray-500 mt-1 font-medium">{formatDate(exp.expense_date)}</p>
                    {exp.description && <p className="text-xs text-[#7a6a55] dark:text-gray-500 mt-1 line-clamp-1 truncate font-medium">{exp.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#1A1208] dark:text-white">{formatExpenseAmount(exp.amount)}</p>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-green-400">Recorded: {formatExpenseAmount(exp.amount_paid)}</p>
                    {exp.amount_pending > 0 && <p className="text-[11px] font-bold text-[#E8650A] dark:text-orange-400">Due: {formatExpenseAmount(exp.amount_pending)}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#1A1208]/10 dark:border-gray-700/50">
                  <button
                    onClick={() => setViewingExpense(exp)}
                    className="text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold cursor-pointer"
                  >
                    View
                  </button>
                  {!eventExpired && (
                    <button
                      onClick={() => openPaymentModal(exp)}
                      className="text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold cursor-pointer"
                    >
                      {`Payment${exp.payments.length ? ` (${exp.payments.length})` : ''}`}
                    </button>
                  )}
                  <span className="text-[11px] text-[#7a6a55] dark:text-gray-500 font-medium ml-auto">
                    {exp.created_by_name ? `Added by ${exp.created_by_name}` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Expense modal — same popup style as the View/Edit modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={resetForm}
        >
          <div
            className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">New Expense</h3>
              <button onClick={resetForm} className="text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white text-xl leading-none cursor-pointer">&times;</button>
            </div>

            <div className="flex flex-col gap-3">
              <FloatingInput
                id="expense-date"
                label="Expense Date"
                type="date"
                value={form.expense_date}
                onChange={e => setField('expense_date', e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <FloatingInput
                  id="vendor-name"
                  label="Vendor Name"
                  value={form.vendor_name}
                  onChange={e => setField('vendor_name', e.target.value.slice(0, 50))}
                />
                <FloatingInput
                  id="vendor-phone"
                  label="Vendor Phone"
                  optional
                  inputMode="numeric"
                  value={form.vendor_phone}
                  onChange={e => setField('vendor_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>

              <FloatingInput
                id="title"
                label="Title"
                value={form.title}
                onChange={e => setField('title', e.target.value.slice(0, 75))}
              />

              <FloatingTextarea
                id="description"
                label="Description"
                optional
                rows={3}
                value={form.description}
                onChange={e => setField('description', e.target.value.slice(0, 500))}
              />

              <FloatingInput
                id="amount"
                label="Estimated Amount (₹)"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setField('amount', e.target.value.slice(0, 12))}
              />

              <div className="flex gap-2 mt-1">
                <button
                  onClick={submitExpenseForm}
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#E8650A]/20"
                >
                  {submitting ? 'Saving...' : 'Add Expense'}
                </button>
                <button onClick={resetForm} className="px-4 bg-white dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment popup — same style as the View popup, split into a scrollable
          history section (top) and a fixed, always-visible form (bottom) */}
      {expandedId && (() => {
        const exp = expenses.find(e => e.id === expandedId)
        if (!exp) return null
        const showForm = exp.amount_pending > 0 || editingPaymentId
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={closePaymentModal}
          >
            <div
              className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header — fixed */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">Payment</h3>
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">{exp.title} · {formatExpenseAmount(exp.amount)}</p>
                </div>
                <button onClick={closePaymentModal} className="text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white text-xl leading-none cursor-pointer">&times;</button>
              </div>

              {/* Payment history — scrollable, ~2 records visible at a time */}
              <div className="px-5 pb-3 overflow-y-auto shrink-0" style={{ maxHeight: '150px' }}>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold mb-1.5">Previous Payments</p>
                {exp.payments.length === 0 && <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No payments recorded yet.</p>}
                <div className="flex flex-col gap-2">
                  {exp.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-lg px-3 py-2 gap-2">
                      <div>
                        <p className="text-xs text-[#1A1208] dark:text-white font-bold">
                          {formatExpenseAmount(p.amount)} <span className="text-[#7a6a55] dark:text-gray-500 font-normal">· {expensePaymentModeLabel(p.payment_mode)}</span>
                        </p>
                        <p className="text-[11px] text-[#7a6a55] dark:text-gray-500">
                          {new Date(p.paid_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {p.transaction_id ? ` · Txn: ${p.transaction_id}` : ''}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      {canEditPayment(p) && (
                        <button onClick={() => startEditPayment(p)} className="text-[11px] text-[#E8650A]/80 dark:text-orange-400/80 hover:text-[#E8650A] dark:hover:text-orange-400 font-bold shrink-0 cursor-pointer">Edit</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* New payment installment — fixed, always visible, never scrolls */}
              {showForm && (
                <div className="px-5 pt-3 pb-5 border-t border-[#1A1208]/10 dark:border-gray-800 shrink-0 flex flex-col gap-2 bg-[#F5EDE2] dark:bg-gray-900">
                  <p className="text-xs font-bold text-[#1A1208] dark:text-gray-300">
                    {editingPaymentId ? 'Edit payment' : 'Record a payment (installment)'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <FloatingInput
                      id={`pay-amount-${exp.id}`}
                      label={`Amount (up to ${formatExpenseAmount(exp.amount_pending + (editingPaymentId ? Number(payAmount || 0) : 0))})`}
                      type="number" min="0" step="0.01"
                      value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    />
                    <FloatingSelect
                      id={`pay-mode-${exp.id}`}
                      label="Payment Mode"
                      value={payMode} onChange={e => setPayMode(e.target.value)}
                    >
                      {EXPENSE_PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </FloatingSelect>
                  </div>
                  <FloatingInput
                    id={`pay-date-${exp.id}`}
                    label="Payment Date"
                    type="datetime-local"
                    value={payDate} onChange={e => setPayDate(e.target.value)}
                  />
                  <FloatingInput
                    id={`pay-txn-${exp.id}`}
                    label="Transaction ID" optional
                    value={payTxnId} onChange={e => setPayTxnId(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 25))}
                  />
                  <FloatingTextarea
                    id={`pay-notes-${exp.id}`}
                    label="Notes" optional rows={2}
                    value={payNotes} onChange={e => setPayNotes(e.target.value.slice(0, 200))}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => submitPayment(exp)} disabled={paySubmitting}
                      className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg cursor-pointer transition-all">
                      {paySubmitting ? 'Saving...' : editingPaymentId ? 'Save Changes' : 'Record Expense'}
                    </button>
                    {editingPaymentId && (
                      <button onClick={resetPaymentForm} className="px-3 bg-white dark:bg-gray-800 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 text-xs font-bold rounded-lg cursor-pointer">Cancel</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {viewingExpense && (
        <ExpenseDetailModal
          expense={viewingExpense as unknown as ExpenseDetail}
          eventExpired={eventExpired}
          onClose={() => setViewingExpense(null)}
          onSaved={(updated) => {
            setExpenses(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
            setViewingExpense(null)
            fetchExpenses()
          }}
          showToast={showToast}
        />
      )}
    </div>
  )
}
