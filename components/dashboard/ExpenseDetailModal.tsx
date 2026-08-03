'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { expensePaymentModeLabel, formatExpenseAmount, EXPENSE_AMOUNT_REGEX } from '@/lib/expensePaymentModes'
import { FloatingInput, FloatingTextarea } from './FloatingField'

export type ExpensePayment = {
  id: string
  amount: number
  paid_at: string
  payment_mode: string | null
  transaction_id: string | null
  notes: string | null
  created_at: string
}

export type ExpenseDetail = {
  id: string
  expense_date: string
  vendor_name: string
  vendor_phone: string | null
  title: string
  description: string | null
  amount: number
  transaction_id?: string | null
  payment_mode?: string | null
  amount_paid: number
  amount_pending: number
  payment_status: 'pending' | 'partially_paid' | 'completed'
  payments: ExpensePayment[]
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_by_name: string | null
  updated_at: string
}

type Props = {
  expense: ExpenseDetail
  eventExpired?: boolean
  onClose: () => void
  onSaved: (updated: ExpenseDetail) => void
  showToast: (msg: string, type: 'success' | 'error') => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN')
}

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

export default function ExpenseDetailModal({ expense, eventExpired = false, onClose, onSaved, showToast }: Props) {
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    expense_date: expense.expense_date,
    vendor_name: expense.vendor_name,
    vendor_phone: expense.vendor_phone || '',
    title: expense.title,
    description: expense.description || '',
    amount: String(expense.amount)
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
    if (!form.amount || Number(form.amount) <= 0) return 'Enter a valid estimated amount'
    if (String(Math.floor(Number(form.amount))).length > 9) return 'Estimated amount cannot exceed 9 digits'
    if (!EXPENSE_AMOUNT_REGEX.test(form.amount.trim())) return 'Estimated amount can have at most 2 decimal places'
    if (Number(form.amount) < expense.amount_paid) {
      return `Estimated Amount cannot be less than the total recorded payment amount (${formatExpenseAmount(expense.amount_paid)})`
    }
    return null
  }

  async function saveChanges() {
    if (eventExpired) { showToast('This event has ended — expenses can no longer be edited', 'error'); return }
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
      amount: Number(form.amount)
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
        className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">{editing ? 'Edit Expense' : 'Expense Details'}</h3>
          <button onClick={onClose} className="text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white text-xl leading-none cursor-pointer">&times;</button>
        </div>

        {!editing ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-lg font-bold text-[#1A1208] dark:text-white">{expense.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-2xl font-bold text-[#E8650A] dark:text-orange-400">{formatExpenseAmount(expense.amount)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_STYLES[expense.payment_status]}`}>
                  {STATUS_LABELS[expense.payment_status]}
                </span>
              </div>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
                Recorded {formatExpenseAmount(expense.amount_paid)}
                {expense.amount_pending > 0 && ` · Remaining ${formatExpenseAmount(expense.amount_pending)}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold">Vendor</p>
                <p className="text-[#1A1208] dark:text-white mt-0.5 font-medium">{expense.vendor_name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold">Vendor Phone</p>
                <p className="text-[#1A1208] dark:text-white mt-0.5 font-medium">{expense.vendor_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold">Expense Date</p>
                <p className="text-[#1A1208] dark:text-white mt-0.5 font-medium">{formatDate(expense.expense_date)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold">Estimated Amount</p>
                <p className="text-[#1A1208] dark:text-white mt-0.5 font-medium">{formatExpenseAmount(expense.amount)}</p>
              </div>
            </div>

            {expense.description && (
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold">Description</p>
                <p className="text-sm text-[#1A1208] dark:text-gray-300 mt-1 whitespace-pre-wrap font-medium">{expense.description}</p>
              </div>
            )}

            {expense.payments.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-500 font-bold mb-2">Payments Recorded ({expense.payments.length})</p>
                <div className="flex flex-col gap-2">
                  {expense.payments.map(p => (
                    <div key={p.id} className="bg-white dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-lg px-3 py-2">
                      <p className="text-xs text-[#1A1208] dark:text-white font-bold">
                        {formatExpenseAmount(p.amount)} <span className="text-[#7a6a55] dark:text-gray-500 font-normal">· {expensePaymentModeLabel(p.payment_mode)}</span>
                      </p>
                      <p className="text-[11px] text-[#7a6a55] dark:text-gray-500 mt-0.5">
                        {formatDateTime(p.paid_at)}
                        {p.transaction_id ? ` · Txn: ${p.transaction_id}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[#1A1208]/10 dark:border-gray-800 pt-3 text-[11px] text-[#7a6a55] dark:text-gray-600 flex flex-col gap-1">
              {expense.created_by_name && <p>Added by {expense.created_by_name} · {formatDateTime(expense.created_at)}</p>}
              {expense.updated_by_name && <p>Last edited by {expense.updated_by_name} · {formatDateTime(expense.updated_at)}</p>}
            </div>

            {eventExpired ? (
              <p className="text-xs text-center text-[#7a6a55] dark:text-gray-500 font-medium mt-1">This event has ended — expenses are now view-only.</p>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full text-sm bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white py-2.5 rounded-xl font-bold mt-1 cursor-pointer transition-all shadow-md shadow-[#E8650A]/20"
              >
                Edit
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <FloatingInput id="edit-expense-date" label="Expense Date" type="date"
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

            <FloatingInput id="edit-amount" label={expense.amount_paid > 0 ? `Estimated Amount (₹) — min ${formatExpenseAmount(expense.amount_paid)}` : 'Estimated Amount (₹)'} type="number" min={expense.amount_paid || 0} step="0.01"
              value={form.amount} onChange={e => setField('amount', e.target.value.slice(0, 12))} />

            <div className="flex gap-2 mt-1">
              <button onClick={saveChanges} disabled={submitting}
                className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-[#E8650A]/20">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 bg-white dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600 text-sm font-bold rounded-xl transition-colors cursor-pointer">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
