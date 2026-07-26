'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type PlanRow = {
  id: string
  name: string
  price: number
  price_label: string
  features: string[]
}

type PlansTabProps = {
  plans: PlanRow[]
  fetchPlans: () => void
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function PlansTab({ plans, fetchPlans, showToast }: PlansTabProps) {
  // Edit/Add Plan modal
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null)
  const [isAddingPlan, setIsAddingPlan] = useState(false)
  const [planFormId, setPlanFormId] = useState('')
  const [planFormName, setPlanFormName] = useState('')
  const [planFormPrice, setPlanFormPrice] = useState('')
  const [planFormFeatures, setPlanFormFeatures] = useState('')
  const [planSubmitting, setPlanSubmitting] = useState(false)

  // ── Plan Actions ─────────────────────────────────────────────
  function openAddPlan() {
    setIsAddingPlan(true)
    setEditingPlan(null)
    setPlanFormId('')
    setPlanFormName('')
    setPlanFormPrice('')
    setPlanFormFeatures('')
  }

  function openEditPlan(p: PlanRow) {
    setIsAddingPlan(false)
    setEditingPlan(p)
    setPlanFormId(p.id)
    setPlanFormName(p.name)
    setPlanFormPrice(p.price.toString())
    setPlanFormFeatures(p.features.join('\n'))
  }

  async function savePlan() {
    if (!planFormId.trim() || !planFormName.trim() || planFormPrice === '') {
      showToast('Please fill all required plan fields', 'error')
      return
    }

    setPlanSubmitting(true)
    const priceNum = parseFloat(planFormPrice)
    const generatedLabel = priceNum === 0 ? 'Free' : `₹${priceNum} / month`

    const body = {
      id: planFormId.trim().toLowerCase(),
      name: planFormName.trim(),
      price: priceNum,
      price_label: generatedLabel,
      features: planFormFeatures.split('\n').map(f => f.trim()).filter(Boolean)
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/plans', {
        method: isAddingPlan ? 'POST' : 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        showToast(isAddingPlan ? 'Plan created successfully' : 'Plan updated successfully', 'success')
        setIsAddingPlan(false)
        setEditingPlan(null)
        fetchPlans()
      } else {
        showToast(data.error || 'Could not save plan', 'error')
      }
    } catch (err) {
      showToast('Could not save plan', 'error')
    }
    setPlanSubmitting(false)
  }

  async function deletePlan(planId: string) {
    if (!confirm(`Are you sure you want to delete the plan "${planId}"?`)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/super-admin/plans?id=${planId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.success) {
        showToast('Plan deleted successfully', 'success')
        fetchPlans()
      } else {
        showToast(data.error || 'Could not delete plan', 'error')
      }
    } catch (err) {
      showToast('Could not delete plan', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Plan Modal */}
      {(isAddingPlan || editingPlan) && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in transition-colors duration-300">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#1A1208]/10 dark:border-gray-800 flex items-start justify-between gap-3 bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <p className="font-extrabold text-[#1A1208] dark:text-white">{isAddingPlan ? 'Add New Subscription Plan' : 'Edit Plan'}</p>
                <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">Customize plan pricing and features</p>
              </div>
              <button onClick={() => { setIsAddingPlan(false); setEditingPlan(null) }} className="text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white text-lg mt-0.5 cursor-pointer font-bold">✕</button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Plan Slug ID */}
              <div>
                <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold font-mono">Plan Code (slug, unique ID)*</label>
                <input type="text" value={planFormId} onChange={e => setPlanFormId(e.target.value)}
                  disabled={!isAddingPlan}
                  placeholder="e.g. premium"
                  className="w-full bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] disabled:opacity-50 disabled:cursor-not-allowed font-medium" />
              </div>

              {/* Plan Name */}
              <div>
                <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Plan Name*</label>
                <input type="text" value={planFormName} onChange={e => setPlanFormName(e.target.value)}
                  placeholder="e.g. Premium Plan"
                  className="w-full bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium" />
              </div>

              {/* Plan Price */}
              <div>
                <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Price (₹)*</label>
                <input type="number" value={planFormPrice} onChange={e => setPlanFormPrice(e.target.value)}
                  placeholder="e.g. 999"
                  className="w-full bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium" />
              </div>

              {/* Plan Features */}
              <div>
                <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Features (one per line)*</label>
                <textarea value={planFormFeatures} onChange={e => setPlanFormFeatures(e.target.value)}
                  rows={4} placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                  className="w-full bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] resize-none font-sans font-medium" />
              </div>

              {/* Save Plan Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={savePlan} disabled={planSubmitting}
                  className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors cursor-pointer shadow-md shadow-[#E8650A]/20">
                  {planSubmitting ? 'Saving...' : 'Save Plan'}
                </button>
                <button onClick={() => { setIsAddingPlan(false); setEditingPlan(null) }}
                  className="px-5 bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600 rounded-xl text-sm font-bold transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan list view */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-extrabold text-[#1A1208] dark:text-white">Subscription Plans</h3>
          <p className="text-xs text-[#7a6a55] dark:text-gray-400">Define the plans displayed to mandal administrators</p>
        </div>
        <button onClick={openAddPlan}
          className="bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-[#E8650A]/20 flex items-center gap-1.5 cursor-pointer">
          <span>+</span> Add Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-[#7a6a55] dark:text-gray-500 text-xs">No plans found in the database.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map(p => (
            <div key={p.id} className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-[#1A1208] dark:text-white text-sm">{p.name}</h4>
                  <span className="text-[9px] font-mono bg-[#F5EDE2] dark:bg-gray-800 text-[#1A1208] dark:text-gray-400 px-2 py-0.5 rounded border border-[#1A1208]/10 dark:border-gray-700 uppercase font-bold">
                    {p.id}
                  </span>
                </div>
                <p className="text-xs text-[#E8650A] dark:text-orange-400 font-extrabold mt-0.5">{p.price_label} (₹{p.price})</p>
                
                {p.features && p.features.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {p.features.map(f => (
                      <span key={f} className="text-[10px] bg-[#F5EDE2] dark:bg-gray-950 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 px-2.5 py-0.5 rounded-full font-medium">
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                <button onClick={() => openEditPlan(p)}
                  className="text-xs bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 px-3.5 py-2 rounded-lg transition-colors font-bold cursor-pointer border border-[#1A1208]/10 dark:border-gray-700">
                  Edit
                </button>
                <button onClick={() => deletePlan(p.id)}
                  className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 px-3.5 py-2 rounded-lg transition-colors font-bold cursor-pointer">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
