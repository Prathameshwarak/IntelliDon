'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EXPENSE_PAYMENT_MODES, expensePaymentModeLabel } from '@/lib/expensePaymentModes'
import { FloatingInput, FloatingTextarea, FloatingSelect } from './FloatingField'

export type ExpenseDetail = {
  id: string
  expense_date: string
  vendor_name: string
  vendor_phone: string | null
  title: string
  description: string | null
  amount: number
  transaction_id: string | null
  payment_mode: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_by_name: string | null
  updated_at: string
}

type Props = {
  expense: ExpenseDetail
  onClose: () => void
  onSaved: (updated: ExpenseDetail) => void
  showToast: (msg: string, type: 'success' | 'error') => void
}

function formatMoney(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN')
}

export default function ExpenseDetailModal({ expense, onClose, onSaved, showToast }: Props) {
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    expense_date: expense.expense_date,
    vendor_name: expense.vendor_name,
    vendor_phone: expense.vendor_phone || '',
    title: expense.title,
    description: expense.description || '',
    amount: String(expense.amount),
    transaction_id: expense.transaction_id || '',
    payment_mode: expense.payment_mode || 'cash'
  })

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
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

  async function saveChanges() {
    const validationError = validate()
    if (validationError) { showToast(validationError, 'error'); return }

    setSubmitting(true)
    const headers = await getAuthHeaders()
    const payload = {
      expense_date: form.expense_date,
      vendor_name: form.vendor_name.trim(),
      vendor_phone: form.vendor_phone.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount),
      transaction_id: form.transaction_id.trim() || null,
      payment_mode: form.payment_mode || null
    }
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) {
        showToast('Expense updated', 'success')
        setEditing(false)
        onSaved({ ...expense, ...data.expense })
      } else {
        showToast(data.error || 'Could not save expense', 'error')
      }
    } catch {
      showToast('Something went wrong', 'error')
    }
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">{editing ? 'Edit Expense' : 'Expense Details'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {!editing ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{expense.title}</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">{formatMoney(expense.amount)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Vendor</p>
                <p className="text-white mt-0.5">{expense.vendor_name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Vendor Phone</p>
                <p className="text-white mt-0.5">{expense.vendor_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Expense Date</p>
                <p className="text-white mt-0.5">{formatDate(expense.expense_date)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Payment Mode</p>
                <p className="text-white mt-0.5">{expensePaymentModeLabel(expense.payment_mode)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Transaction ID</p>
                <p className="text-white mt-0.5">{expense.transaction_id || '—'}</p>
              </div>
            </div>

            {expense.description && (
              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold">Description</p>
                <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{expense.description}</p>
              </div>
            )}

            <div className="border-t border-gray-800 pt-3 text-[11px] text-gray-600 flex flex-col gap-1">
              {expense.created_by_name && <p>Added by {expense.created_by_name} · {formatDateTime(expense.created_at)}</p>}
              {expense.updated_by_name && <p>Last edited by {expense.updated_by_name} · {formatDateTime(expense.updated_at)}</p>}
            </div>

            <button
              onClick={() => setEditing(true)}
              className="w-full text-sm bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium mt-1"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <FloatingInput id="edit-expense-date" label="Expense Date" type="date" style={{ colorScheme: 'dark' }}
              value={form.expense_date} onChange={e => setField('expense_date', e.target.value)} />

            <div className="grid grid-cols-2 gap-3">
              <FloatingInput id="edit-vendor-name" label="Vendor Name"
                value={form.vendor_name} onChange={e => setField('vendor_name', e.target.value.slice(0, 50))} />
              <FloatingInput id="edit-vendor-phone" label="Vendor Phone" optional inputMode="numeric"
                value={form.vendor_phone} onChange={e => setField('vendor_phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>

            <FloatingInput id="edit-title" label="Title"
              value={form.title} onChange={e => setField('title', e.target.value.slice(0, 75))} />

            <FloatingTextarea id="edit-description" label="Description" optional rows={3}
              value={form.description} onChange={e => setField('description', e.target.value.slice(0, 500))} />

            <div className="grid grid-cols-2 gap-3">
              <FloatingInput id="edit-amount" label="Amount (₹)" type="number" min="0" step="0.01"
                value={form.amount} onChange={e => setField('amount', e.target.value.slice(0, 9))} />
              <FloatingSelect id="edit-payment-mode" label="Payment Mode"
                value={form.payment_mode} onChange={e => setField('payment_mode', e.target.value)}>
                {EXPENSE_PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </FloatingSelect>
            </div>

            <FloatingInput id="edit-transaction-id" label="Transaction ID" optional
              value={form.transaction_id} onChange={e => setField('transaction_id', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 25))} />

            <div className="flex gap-2 mt-1">
              <button onClick={saveChanges} disabled={submitting}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
