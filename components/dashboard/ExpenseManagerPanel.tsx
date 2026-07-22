'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadExpenseReport, shareExpenseReport, type ExpenseReportRow } from '@/lib/downloadExpenseReport'
import { FloatingInput, FloatingTextarea, FloatingSelect } from './FloatingField'
import { EXPENSE_PAYMENT_MODES } from '@/lib/expensePaymentModes'
import ExpenseDetailModal from './ExpenseDetailModal'

type Expense = ExpenseReportRow & {
  id: string
  payment_mode?: string | null
}

type Props = {
  mandalId: string
  eventId: string
  eventLabel: string
  showToast: (msg: string, type: 'success' | 'error') => void
  onBack: () => void
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const emptyForm = {
  expense_date: new Date().toISOString().split('T')[0],
  vendor_name: '',
  vendor_phone: '',
  title: '',
  description: '',
  amount: '',
  payment_mode: 'cash',
  transaction_id: ''
}

export default function ExpenseManagerPanel({ mandalId, eventId, eventLabel, showToast, onBack }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState({ total_amount: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)

  // Which format-choice popover is open, if any
  const [openMenu, setOpenMenu] = useState<'download' | 'share' | null>(null)
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

  // Close the download/share format popover on an outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  function setField<K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
  }

  function validate(): string | null {
    if (!form.expense_date) return 'Expense date is required'
    if (!form.vendor_name.trim()) return 'Vendor name is required'
    if (form.vendor_name.trim().length > 50) return 'Vendor name must be 50 characters or fewer'
    if (form.vendor_phone && !/^[0-9]{10}$/.test(form.vendor_phone.trim())) return 'Vendor phone must be exactly 10 digits'
    if (!form.title.trim()) return 'Title is required'
    if (form.title.trim().length > 75) return 'Title must be 75 characters or fewer'
    if (form.description && form.description.trim().length > 500) return 'Description must be 500 characters or fewer'
    if (!form.amount || Number(form.amount) <= 0) return 'Enter a valid amount'
    if (String(Math.floor(Number(form.amount))).length > 9) return 'Amount cannot exceed 9 digits'
    if (form.transaction_id && form.transaction_id.trim()) {
      if (form.transaction_id.trim().length > 25) return 'Transaction ID must be 25 characters or fewer'
      if (!/^[A-Za-z0-9]+$/.test(form.transaction_id.trim())) return 'Transaction ID must be alphanumeric'
    }
    return null
  }

  async function submitExpenseForm() {
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
      amount: Number(form.amount),
      payment_mode: form.payment_mode || 'cash',
      transaction_id: form.transaction_id.trim() || null
    }
    const res = editingId
      ? await fetch(`/api/expenses/${editingId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      : await fetch('/api/expenses', { method: 'POST', headers, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.success) {
      showToast(editingId ? 'Expense updated' : 'Expense added', 'success')
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
        await downloadExpenseReport(format, eventLabel, expenses, summary)
      } else {
        await shareExpenseReport(format, eventLabel, expenses, summary)
      }
    } catch (err) {
      console.error(err)
      showToast('Could not export the report', 'error')
    }
    setExporting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors self-start group cursor-pointer"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Events List
      </button>

      <div>
        <h3 className="text-sm font-semibold text-white">Expense Management</h3>
        <p className="text-xs text-gray-500 mt-0.5">{eventLabel}</p>
      </div>

      {/* Summary — 3 grid boxes */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">Entries</p>
          <p className="text-sm font-semibold text-white mt-1">{summary.count}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-[10px] uppercase text-gray-500 font-bold">Total Expenses</p>
          <p className="text-sm font-semibold text-white mt-1">{formatMoney(summary.total_amount)}</p>
        </div>
        <div ref={menuRef} className="relative bg-gray-800 border border-gray-700 rounded-lg p-2 flex flex-col gap-1.5 justify-center">
          <button
            onClick={() => setOpenMenu(openMenu === 'download' ? null : 'download')}
            disabled={exporting}
            className="text-[11px] bg-gray-700/70 hover:bg-gray-700 text-gray-200 py-1.5 rounded-md font-medium disabled:opacity-50 cursor-pointer"
          >
            ⬇ Download
          </button>
          <button
            onClick={() => setOpenMenu(openMenu === 'share' ? null : 'share')}
            disabled={exporting}
            className="text-[11px] bg-gray-700/70 hover:bg-gray-700 text-gray-200 py-1.5 rounded-md font-medium disabled:opacity-50 cursor-pointer"
          >
            ↗ Share
          </button>

          {openMenu && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
              <p className="text-[10px] uppercase text-gray-500 font-bold px-3 pt-2 pb-1">Choose format</p>
              <button
                onClick={() => handleExport(openMenu, 'pdf')}
                className="w-full text-left text-xs text-gray-200 hover:bg-gray-800 px-3 py-2 cursor-pointer"
              >
                📄 PDF
              </button>
              <button
                onClick={() => handleExport(openMenu, 'excel')}
                className="w-full text-left text-xs text-gray-200 hover:bg-gray-800 px-3 py-2 cursor-pointer"
              >
                📊 Excel
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => (showForm ? resetForm() : setShowForm(true))}
        className="w-full text-sm bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium cursor-pointer"
      >
        {showForm ? 'Close Form' : '+ Add Expense'}
      </button>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-white">{editingId ? 'Edit Expense' : 'New Expense'}</p>

          <FloatingInput
            id="expense-date"
            label="Expense Date"
            type="date"
            style={{ colorScheme: 'dark' }}
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

          <div className="grid grid-cols-2 gap-3">
            <FloatingInput
              id="amount"
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => setField('amount', e.target.value.slice(0, 9))}
            />
            <FloatingSelect
              id="payment-mode"
              label="Payment Mode"
              value={form.payment_mode}
              onChange={e => setField('payment_mode', e.target.value)}
            >
              {EXPENSE_PAYMENT_MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </FloatingSelect>
          </div>

          <FloatingInput
            id="transaction-id"
            label="Transaction ID"
            optional
            value={form.transaction_id}
            onChange={e => setField('transaction_id', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 25))}
          />

          <div className="flex gap-2 mt-1">
            <button
              onClick={submitExpenseForm}
              disabled={submitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg cursor-pointer"
            >
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Expense'}
            </button>
            <button onClick={resetForm} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm text-center py-8">Loading expenses...</p>
      ) : expenses.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No expenses recorded for this event.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{exp.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {exp.vendor_name}{exp.vendor_phone ? ` · ${exp.vendor_phone}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(exp.expense_date)}</p>
                  {exp.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1 truncate">{exp.description}</p>}
                  {exp.transaction_id && <p className="text-[11px] text-gray-600 mt-1">Txn: {exp.transaction_id}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white">{formatMoney(exp.amount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-700/50">
                <button
                  onClick={() => setViewingExpense(exp)}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
                >
                  View
                </button>
                <span className="text-[11px] text-gray-600">
                  {exp.created_by_name ? `Added by ${exp.created_by_name}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingExpense && (
        <ExpenseDetailModal
          expense={viewingExpense as any}
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
