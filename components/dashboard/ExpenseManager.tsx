'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Expense = {
  id: string
  description: string
  amount: number
  category: string | null
  created_at: string
  added_by: string | null
  users?: { full_name: string } | null
}

type ExpenseManagerProps = {
  mandalId: string
  eventId: string
  eventLabel: string
  addedBy?: string | null
  showToast: (msg: string, type: 'success' | 'error') => void
  onClose: () => void
}

function formatAmount(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ExpenseManager({
  mandalId,
  eventId,
  eventLabel,
  addedBy,
  showToast,
  onClose,
}: ExpenseManagerProps) {
  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function fetchExpenses() {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/expenses?mandal_id=${mandalId}&event_id=${eventId}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load expenses')
      setExpenses(data.expenses || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load expenses', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()

    if (!description.trim()) { showToast('Please enter a description', 'error'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    setSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mandal_id: mandalId,
          event_id: eventId,
          description: description.trim(),
          amount: Number(amount),
          category: category.trim() || null,
          added_by: addedBy || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add expense')

      showToast('Expense added successfully!', 'success')
      setDescription('')
      setAmount('')
      setCategory('')
      fetchExpenses()
    } catch (err: any) {
      showToast(err.message || 'Failed to add expense', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete expense')
      showToast('Expense deleted', 'success')
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      showToast(err.message || 'Failed to delete expense', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Manage Expenses</h3>
            <p className="text-xs text-gray-400 mt-0.5">{eventLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Total summary */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 mb-5 flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Expenses</span>
          <span className="font-mono text-sm font-bold text-orange-400 tracking-wide">{formatAmount(total)}</span>
        </div>

        {/* Add expense form */}
        <form onSubmit={handleAddExpense} className="space-y-4 mb-5">
          <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Add New Expense</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Decoration materials"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            {submitting ? 'Adding...' : 'Add Expense'}
          </button>
        </form>

        {/* Expense list */}
        <div className="border-t border-gray-800 pt-4">
          <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3">Recorded Expenses</h4>

          {loading ? (
            <p className="text-xs text-gray-500 text-center py-6">Loading...</p>
          ) : expenses.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between bg-gray-950/60 border border-gray-800 rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{exp.description}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {exp.category && <span>{exp.category} · </span>}
                      {formatDate(exp.created_at)}
                      {exp.users?.full_name && <span> · {exp.users.full_name}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs font-semibold text-white">{formatAmount(exp.amount)}</span>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={deletingId === exp.id}
                      className="text-gray-500 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
