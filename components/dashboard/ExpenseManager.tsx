'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FloatingInput, FloatingTextarea, FloatingSelect } from './FloatingField'
import { EXPENSE_PAYMENT_MODES } from '@/lib/expensePaymentModes'
import ExpenseDetailModal from './ExpenseDetailModal'

type Expense = {
  id: string
  expense_date: string
  vendor_name: string
  vendor_phone: string | null
  title: string
  description: string | null
  amount: number
  transaction_id: string | null
  payment_mode?: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_by_name: string | null
  updated_at: string
}

type Props = {
  mandalId: string
  eventId: string
  eventLabel: string
  showToast: (msg: string, type: 'success' | 'error') => void
  onClose: () => void
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
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

export default function ExpenseManager({ mandalId, eventId, eventLabel, showToast, onClose }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState({ total_amount: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)

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
    if (fromDate) qs.set('from_date', fromDate)
    if (toDate) qs.set('to_date', toDate)
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

  useEffect(() => { fetchExpenses() }, [eventId, fromDate, toDate])

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

  function exportPDF() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const rows = expenses.map(e => `
      <tr>
        <td>${formatDate(e.expense_date)}</td>
        <td>${escapeHtml(e.vendor_name)}</td>
        <td>${e.vendor_phone ? escapeHtml(e.vendor_phone) : '—'}</td>
        <td>${escapeHtml(e.title)}</td>
        <td style="text-align:right">${formatMoney(e.amount)}</td>
        <td>${e.transaction_id ? escapeHtml(e.transaction_id) : '—'}</td>
      </tr>`).join('')

    printWindow.document.write(`
      <html><head><title>Expense Report — ${escapeHtml(eventLabel)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        p.sub { color: #666; font-size: 12px; margin-top: 0; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f2f2f2; }
        .summary { margin-top: 16px; font-size: 13px; font-weight: bold; }
      </style></head>
      <body>
        <h1>Expense Report</h1>
        <p class="sub">${escapeHtml(eventLabel)} ${fromDate || toDate ? `· ${fromDate || 'start'} to ${toDate || 'today'}` : ''} · Generated ${new Date().toLocaleString('en-IN')}</p>
        <table>
          <thead><tr><th>Expense Date</th><th>Vendor Name</th><th>Vendor Phone</th><th>Title</th><th>Amount</th><th>Transaction ID</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="summary">Total: ${formatMoney(summary.total_amount)} across ${summary.count} expense${summary.count !== 1 ? 's' : ''}</p>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  function exportExcel() {
    const headerRow = ['Expense Date', 'Vendor Name', 'Vendor Phone', 'Title', 'Description', 'Amount', 'Transaction ID', 'Created At', 'Created By', 'Updated At']
    const csvEscape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [headerRow.map(csvEscape).join(',')]
    for (const e of expenses) {
      lines.push([
        formatDate(e.expense_date),
        e.vendor_name,
        e.vendor_phone || '',
        e.title,
        e.description || '',
        e.amount,
        e.transaction_id || '',
        new Date(e.created_at).toLocaleString('en-IN'),
        e.created_by_name || '',
        new Date(e.updated_at).toLocaleString('en-IN')
      ].map(csvEscape).join(','))
    }
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${eventLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Expense Management</h3>
            <p className="text-xs text-gray-500">{eventLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none cursor-pointer">&times;</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Total Expenses</p>
            <p className="text-sm font-semibold text-white mt-1">{formatMoney(summary.total_amount)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-[10px] uppercase text-gray-500 font-bold">Entries</p>
            <p className="text-sm font-semibold text-white mt-1">{summary.count}</p>
          </div>
        </div>

        {/* Date range filter + exports */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex gap-2 flex-1">
            <input value={fromDate} onChange={e => setFromDate(e.target.value)} type="date" placeholder="From"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
            <input value={toDate} onChange={e => setToDate(e.target.value)} type="date" placeholder="To"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-orange-500" style={{ colorScheme: 'dark' }} />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate('') }} className="text-xs text-gray-500 hover:text-white px-2 cursor-pointer">Clear</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={exportPDF} disabled={expenses.length === 0}
              className="flex-1 sm:flex-none text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg disabled:opacity-40 cursor-pointer">
              📄 Export PDF
            </button>
            <button onClick={exportExcel} disabled={expenses.length === 0}
              className="flex-1 sm:flex-none text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg disabled:opacity-40 cursor-pointer">
              📊 Export Excel
            </button>
          </div>
        </div>

        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="w-full text-sm bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium mb-4 cursor-pointer"
        >
          {showForm ? 'Close Form' : '+ Add Expense'}
        </button>

        {showForm && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 mb-4">
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

            <div className="flex gap-2">
              <button onClick={submitExpenseForm} disabled={submitting}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg cursor-pointer">
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Expense'}
              </button>
              <button onClick={resetForm} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm text-center py-8">Loading expenses...</p>
        ) : expenses.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No expenses recorded for this range.</p>
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
                  <button onClick={() => setViewingExpense(exp)} className="text-xs text-orange-400 hover:text-orange-300 font-medium cursor-pointer">View</button>
                  <span className="text-[11px] text-gray-600">
                    {exp.created_by_name ? `Added by ${exp.created_by_name}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
