'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Plan = {
  id: string
  name: string
  code: string
  price: number
  duration_days: number
  features: string[]
  description: string
}

export default function SuperAdminPlansPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [superAdminName, setSuperAdminName] = useState('')
  const [superAdminId, setSuperAdminId] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Plans State
  const [plans, setPlans] = useState<Plan[]>([])
  const [isFallback, setIsFallback] = useState(false)

  // Form State
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDurationDays, setFormDurationDays] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFeatures, setFormFeatures] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Available features checklist
  const AVAILABLE_FEATURES = ['events', 'donations', 'team', 'history', 'reports']

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
      fetchPlans()
    }
  }, [authorized])

  async function fetchPlans() {
    setLoading(true)
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      if (data.success) {
        setPlans(data.plans || [])
        setIsFallback(!!data.isFallback)
      } else {
        showToast(data.error || 'Failed to load plans', 'error')
      }
    } catch (err) {
      showToast('Error fetching plans definitions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFeatureToggle = (feature: string) => {
    if (formFeatures.includes(feature)) {
      setFormFeatures(prev => prev.filter(f => f !== feature))
    } else {
      setFormFeatures(prev => [...prev, feature])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isFallback) {
      showToast('Cannot add/edit plans while in Fallback mode. Please run SQL script to initialize table.', 'error')
      return
    }

    if (!formName.trim() || !formCode.trim() || !formPrice || !formDurationDays) {
      showToast('Please fill all required fields', 'error')
      return
    }

    setSubmitting(true)
    try {
      const headers = { 'Content-Type': 'application/json', 'x-user-id': superAdminId }
      const payload = {
        id: editingId,
        name: formName,
        code: formCode,
        price: Number(formPrice),
        duration_days: Number(formDurationDays),
        features: formFeatures,
        description: formDescription
      }

      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch('/api/plans', {
        method,
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.success) {
        showToast(editingId ? 'Plan updated successfully' : 'Plan defined successfully', 'success')
        resetForm()
        fetchPlans()
      } else {
        showToast(data.error || 'Operation failed', 'error')
      }
    } catch (err) {
      showToast('Could not save plan definition', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (isFallback) {
      showToast('Cannot delete plans in Fallback mode.', 'error')
      return
    }

    if (!confirm('Are you sure you want to delete this subscription plan definition? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/plans?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': superAdminId }
      })
      const data = await res.json()
      if (data.success) {
        showToast('Plan deleted successfully', 'success')
        fetchPlans()
      } else {
        showToast(data.error || 'Delete failed', 'error')
      }
    } catch (err) {
      showToast('Could not delete plan', 'error')
    }
  }

  const startEdit = (plan: Plan) => {
    if (isFallback) {
      showToast('Cannot edit plans in Fallback mode.', 'error')
      return
    }
    setEditingId(plan.id)
    setFormName(plan.name)
    setFormCode(plan.code)
    setFormPrice(plan.price.toString())
    setFormDurationDays(plan.duration_days.toString())
    setFormDescription(plan.description || '')
    setFormFeatures(plan.features || [])
  }

  const resetForm = () => {
    setEditingId(null)
    setFormName('')
    setFormCode('')
    setFormPrice('')
    setFormDurationDays('')
    setFormDescription('')
    setFormFeatures([])
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
              <Link href="/super-admin/subscriptions" className="hover:text-white transition-colors">
                Subscriptions
              </Link>
              <span className="text-white border-b-2 border-orange-500 pb-1">
                Plan Editor
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
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Subscription Plan Definitions</h2>
          <p className="text-xs text-gray-400">Define global pricing plan templates, features, and durations for mandal memberships.</p>
        </div>

        {/* Fallback Warning Banner */}
        {isFallback && (
          <div className="bg-yellow-950/20 border border-yellow-900/50 rounded-xl p-4 text-xs text-yellow-300">
            ⚠️ <strong>Fallback Mode Active</strong>: The database table `subscription_plans` was not found. Displaying default Monthly/Yearly template configs. Create the table in Supabase editor to unlock CRUD capabilities.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Creator form */}
          <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 h-fit">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-500">
              {editingId ? '✏️ Edit Plan Config' : '✨ Define Plan'}
            </h3>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Plan Name *</label>
                <input
                  type="text"
                  placeholder="E.g. Monthly Premium"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  disabled={isFallback}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Unique Plan Code *</label>
                <input
                  type="text"
                  placeholder="E.g. monthly, yearly, half-yearly"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  disabled={isFallback || !!editingId}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="E.g. 399"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                    disabled={isFallback}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    placeholder="E.g. 30"
                    value={formDurationDays}
                    onChange={e => setFormDurationDays(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                    disabled={isFallback}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Capabilities/Features Checklist</label>
                <div className="flex flex-col gap-2 bg-gray-950 p-3 rounded-lg border border-gray-850">
                  {AVAILABLE_FEATURES.map(feat => {
                    const isChecked = formFeatures.includes(feat)
                    return (
                      <label key={feat} className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleFeatureToggle(feat)}
                          className="rounded border-gray-800 bg-gray-900 text-orange-500 focus:ring-0"
                          disabled={isFallback}
                        />
                        <span className="capitalize">{feat} Management</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Short Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Key highlight shown on payment page"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                  disabled={isFallback}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || isFallback}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {submitting ? 'Saving...' : 'Define settings'}
                </button>
                {editingId && (
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

          {/* Table display */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-500">
              📋 Defined Plan Templates
            </h3>

            {loading ? (
              <p className="text-xs text-gray-400">Loading plan configs...</p>
            ) : (
              <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl overflow-hidden shadow-xl text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-500 font-medium">
                      <th className="p-3">Plan Name</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Capabilities</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {plans.map(p => (
                      <tr key={p.id || p.code} className="hover:bg-gray-800/10 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-white">{p.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{p.description || 'No description'}</p>
                        </td>
                        <td className="p-3 font-mono text-gray-400">{p.code}</td>
                        <td className="p-3 font-bold text-white">₹{p.price}</td>
                        <td className="p-3 text-gray-300">{p.duration_days} days</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {p.features.map(f => (
                              <span key={f} className="bg-gray-950 border border-gray-850 px-1.5 py-0.5 rounded text-[10px] text-gray-400 capitalize">
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          <button
                            onClick={() => startEdit(p)}
                            disabled={isFallback}
                            className="text-orange-500 hover:text-orange-400 disabled:text-gray-600 font-medium text-[10px] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={isFallback}
                            className="text-red-500 hover:text-red-400 disabled:text-gray-600 font-medium text-[10px] transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  )
}
