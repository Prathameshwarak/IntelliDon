'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type MandalOption = {
  id: string
  name: string
  status: string
}

type SubscriptionRecord = {
  id: string
  mandal_id: string
  plan: string
  status: string
  starts_at: string
  ends_at: string
  amount: number
  payment_status: string
  payment_notes: string
  verified_by: string | null
  verified_at: string | null
  created_at: string
  mandals?: {
    name: string
  }
}

export default function SuperAdminSubscriptionsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [superAdminName, setSuperAdminName] = useState('')
  const [superAdminId, setSuperAdminId] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Data State
  const [mandals, setMandals] = useState<MandalOption[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])

  // Form State
  const [formMandalId, setFormMandalId] = useState('')
  const [formPlan, setFormPlan] = useState<'trial' | 'monthly' | 'yearly'>('monthly')
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')
  const [formStartsAt, setFormStartsAt] = useState('')
  const [formEndsAt, setFormEndsAt] = useState('')
  const [formAmount, setFormAmount] = useState('399')
  const [formNotes, setFormNotes] = useState('')
  const [submittingForm, setSubmittingForm] = useState(false)
  const [editingSubId, setEditingSubId] = useState<string | null>(null)

  // Verification Rejection State
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingRejection, setSubmittingRejection] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null) // approve loading

  // Lightbox screenshot
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .single()

      if (!userRow || userRow.role !== 'super_admin') {
        router.push('/')
        return
      }

      setSuperAdminId(user.id)
      setSuperAdminName(userRow.full_name || 'Super Admin')
      setAuthorized(true)
    }
    checkAccess()
  }, [router])

  useEffect(() => {
    if (authorized) {
      fetchData()
    }
  }, [authorized])

  async function fetchData() {
    setLoading(true)
    try {
      const headers: HeadersInit = {
        'x-user-id': superAdminId
      }
      const res = await fetch('/api/super-admin/subscriptions', { headers })
      const data = await res.json()
      if (data.success) {
        setMandals(data.mandals || [])
        setSubscriptions(data.subscriptions || [])
      } else {
        showToast(data.error || 'Failed to load data', 'error')
      }
    } catch (err) {
      showToast('Error connecting to API', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate default dates when plan selection changes
  useEffect(() => {
    if (!editingSubId) {
      const start = new Date()
      const end = new Date(start)
      if (formPlan === 'trial') {
        end.setDate(end.getDate() + 30)
        setFormAmount('0')
      } else if (formPlan === 'monthly') {
        end.setDate(end.getDate() + 30)
        setFormAmount('399')
      } else if (formPlan === 'yearly') {
        end.setDate(end.getDate() + 365)
        setFormAmount('3999')
      }
      setFormStartsAt(start.toISOString().split('T')[0])
      setFormEndsAt(end.toISOString().split('T')[0])
    }
  }, [formPlan, editingSubId])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formMandalId || !formStartsAt || !formEndsAt) {
      showToast('Please fill all required fields', 'error')
      return
    }

    setSubmittingForm(true)
    try {
      const headers = { 'Content-Type': 'application/json', 'x-user-id': superAdminId }
      
      const payload = {
        subscription_id: editingSubId,
        mandal_id: formMandalId,
        plan: formPlan,
        status: formStatus,
        starts_at: new Date(formStartsAt).toISOString(),
        ends_at: new Date(formEndsAt).toISOString(),
        amount: Number(formAmount),
        payment_notes: formNotes,
        super_admin_id: superAdminId,
        action: editingSubId ? 'edit' : undefined
      }

      const url = '/api/super-admin/subscriptions'
      const method = editingSubId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.success) {
        showToast(editingSubId ? 'Subscription updated' : 'Subscription created', 'success')
        resetForm()
        fetchData()
      } else {
        showToast(data.error || 'Operation failed', 'error')
      }
    } catch (err) {
      showToast('API communication error', 'error')
    } finally {
      setSubmittingForm(false)
    }
  }

  const handleApprove = async (subId: string) => {
    setActioningId(subId)
    try {
      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': superAdminId },
        body: JSON.stringify({
          subscription_id: subId,
          action: 'approve',
          super_admin_id: superAdminId
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Subscription payment approved', 'success')
        fetchData()
      } else {
        showToast(data.error || 'Approval failed', 'error')
      }
    } catch (err) {
      showToast('Could not approve subscription', 'error')
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingId) return
    setSubmittingRejection(true)

    try {
      const res = await fetch('/api/super-admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': superAdminId },
        body: JSON.stringify({
          subscription_id: rejectingId,
          action: 'reject',
          rejection_reason: rejectionReason,
          super_admin_id: superAdminId
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Subscription request rejected', 'success')
        setRejectingId(null)
        setRejectionReason('')
        fetchData()
      } else {
        showToast(data.error || 'Rejection failed', 'error')
      }
    } catch (err) {
      showToast('Could not reject request', 'error')
    } finally {
      setSubmittingRejection(false)
    }
  }

  const startEdit = (sub: SubscriptionRecord) => {
    setEditingSubId(sub.id)
    setFormMandalId(sub.mandal_id)
    setFormPlan(sub.plan as any)
    setFormStatus(sub.status as any)
    setFormStartsAt(sub.starts_at.split('T')[0])
    setFormEndsAt(sub.ends_at.split('T')[0])
    setFormAmount(sub.amount.toString())
    setFormNotes(sub.payment_notes || '')
  }

  const resetForm = () => {
    setEditingSubId(null)
    setFormMandalId('')
    setFormPlan('monthly')
    setFormStatus('active')
    setFormNotes('')
  }

  const parseScreenshotUrl = (notes: string) => {
    if (!notes) return null
    if (notes.startsWith('Screenshot: ')) {
      const parts = notes.split('\nNotes:')
      const urlPart = parts[0].substring('Screenshot: '.length).trim()
      return urlPart || null
    }
    const match = notes.match(/Screenshot:\s*(https?:\/\/[^\s\n]+)/)
    return match ? match[1] : null
  }

  const parseNotes = (notes: string) => {
    if (!notes) return ''
    if (notes.startsWith('Screenshot: ')) {
      const parts = notes.split('\nNotes:')
      if (parts.length > 1) {
        return parts.slice(1).join('\nNotes:').trim()
      }
    }
    return notes
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Verifying auth credentials...</p>
      </div>
    )
  }

  const pendingRequests = subscriptions.filter(s => s.payment_status === 'pending')

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col relative overflow-hidden">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl flex items-center space-x-2.5 border transition-all ${
          toast.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-500' : 'bg-rose-950/80 border-rose-500/30 text-rose-500'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Screenshot lightbox */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <img src={activeScreenshot} alt="Payment receipt" className="w-full rounded-xl border border-gray-800 shadow-2xl" />
            <button
              onClick={() => setActiveScreenshot(null)}
              className="mt-3 w-full bg-gray-800 text-gray-300 py-2.5 rounded-lg text-xs hover:bg-gray-700 transition-colors"
            >
              Close Receipt Image
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#07090e]/60 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-white font-black text-lg italic">i</span>
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wide">Intellidon</h1>
              <p className="text-[9px] text-indigo-400 font-mono tracking-wider uppercase leading-none">Super Admin Control</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="flex space-x-4 text-xs font-semibold text-gray-400">
              <Link href="/super-admin/mandals" className="hover:text-white transition-colors">
                Mandals
              </Link>
              <span className="text-white border-b-2 border-orange-500 pb-1">
                Subscriptions
              </span>
            </nav>
            <button 
              onClick={handleSignOut}
              className="text-xs font-semibold py-2 px-3 border border-slate-800 bg-[#0b0f19] text-slate-300 hover:bg-slate-900 rounded-xl transition-all shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col gap-8 relative z-10">
        
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Subscription Manager</h2>
          <p className="text-xs text-gray-400">Add, modify, and review platform membership payments and plan logs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Manual Creator Form */}
          <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 h-fit">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-500">
              {editingSubId ? '✏️ Edit Subscription' : '✨ Manual Setup'}
            </h3>
            
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Mandal Name *</label>
                <select
                  value={formMandalId}
                  onChange={e => setFormMandalId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  required
                >
                  <option value="">Select Mandal</option>
                  {mandals.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Plan *</label>
                  <select
                    value={formPlan}
                    onChange={e => setFormPlan(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  >
                    <option value="trial">Trial</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Status *</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Starts At *</label>
                  <input
                    type="date"
                    value={formStartsAt}
                    onChange={e => setFormStartsAt(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Ends At *</label>
                  <input
                    type="date"
                    value={formEndsAt}
                    onChange={e => setFormEndsAt(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Payment/Audit Notes</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={3}
                  placeholder="Payment remarks or Super Admin setup logs"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {submittingForm ? 'Saving...' : 'Save Settings'}
                </button>
                {editingSubId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-850 hover:bg-gray-800 border border-gray-850 text-gray-300 px-3 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Pending Request Queue */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-yellow-500">
              📥 Pending Approvals ({pendingRequests.length})
            </h3>
            
            {loading ? (
              <p className="text-xs text-gray-400">Loading requests...</p>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 text-center text-xs text-gray-500">
                No pending subscription payment verifications.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pendingRequests.map(r => {
                  const screenshotUrl = parseScreenshotUrl(r.payment_notes)
                  const userNotes = parseNotes(r.payment_notes)

                  return (
                    <div key={r.id} className="bg-[#0b0f19] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{r.mandals?.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-950 border border-yellow-900/30 text-yellow-400 uppercase">
                            {r.plan}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white mt-2">Amount: ₹{r.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-1 font-mono">Txn details: {userNotes}</p>
                        <p className="text-[10px] text-gray-500 mt-1.5">Submitted On: {new Date(r.created_at).toLocaleString()}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {screenshotUrl && (
                          <button
                            onClick={() => setActiveScreenshot(screenshotUrl)}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-lg transition-colors border border-gray-750"
                          >
                            🖼️ View Receipt
                          </button>
                        )}

                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={actioningId === r.id}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors shadow-md"
                        >
                          {actioningId === r.id ? 'Approving...' : 'Approve'}
                        </button>

                        <button
                          onClick={() => setRejectingId(r.id)}
                          className="bg-red-900/30 border border-red-900/50 hover:bg-red-900/50 text-red-300 font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rejection Modal/Inline Input */}
        {rejectingId && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleReject} className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-w-sm w-full flex flex-col gap-4 text-xs shadow-2xl">
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Reject Subscription Payment</h4>
                <p className="text-[11px] text-gray-400">Specify the rejection reason. This audit log will be visible to the Mandal admin.</p>
              </div>
              <div>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="E.g. Transaction ID mismatch, payment not received in bank account."
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  required
                />
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="submit"
                  disabled={submittingRejection}
                  className="flex-1 bg-red-650 hover:bg-red-700 disabled:bg-gray-800 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {submittingRejection ? 'Rejecting...' : 'Reject Request'}
                </button>
                <button
                  type="button"
                  onClick={() => { setRejectingId(null); setRejectionReason('') }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3.5 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Historical List */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
            📋 All Subscription Logs ({subscriptions.length})
          </h3>
          {subscriptions.length === 0 ? (
            <p className="text-xs text-gray-500 bg-[#0b0f19]/30 border border-gray-800 rounded-xl p-4 text-center">No subscriptions recorded.</p>
          ) : (
            <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-500 font-medium">
                      <th className="p-3">Mandal</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Starts At</th>
                      <th className="p-3">Ends At</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Verification Details</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {subscriptions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-800/10 transition-colors">
                        <td className="p-3 font-semibold text-white">{s.mandals?.name}</td>
                        <td className="p-3 text-gray-300 uppercase font-medium">{s.plan}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide
                            ${s.status === 'active' ? 'bg-green-950 text-green-400 border border-green-900/20' 
                            : 'bg-gray-850 text-gray-400 border border-gray-800'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono">{new Date(s.starts_at).toLocaleDateString()}</td>
                        <td className="p-3 text-gray-400 font-mono">{new Date(s.ends_at).toLocaleDateString()}</td>
                        <td className="p-3 text-white font-bold">₹{s.amount.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide
                            ${s.payment_status === 'verified' ? 'bg-green-950 text-green-400 border border-green-900/20' 
                            : s.payment_status === 'rejected' ? 'bg-rose-950 text-rose-400 border border-rose-900/20'
                            : 'bg-yellow-950 text-yellow-400 border border-yellow-900/20'}`}>
                            {s.payment_status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 max-w-xs truncate" title={s.payment_notes}>
                          {s.payment_notes || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => startEdit(s)}
                            className="bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold text-[10px] px-2 py-1 rounded transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
