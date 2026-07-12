'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  full_name: string | null
  phone: string | null
  role: string
}

type Subscription = {
  plan: string
  status: string
  ends_at: string | null
}

type Mandal = {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  phone: string | null
  status: 'pending' | 'active' | 'suspended'
  created_at: string
  admin_full_name: string | null
  admin_email: string | null
  admin_phone: string | null
  pincode: string | null
  upi_id: string | null
  doc_reg_cert: string | null
  doc_admin_aadhaar: string | null
  doc_admin_pan: string | null
  doc_org_pan: string | null
  doc_bank_proof: string | null
  doc_auth_letter: string | null
  doc_address_proof: string | null
  kyc_status: 'pending' | 'in_review' | 'approved' | 'rejected' | null
  kyc_notes: string | null
  users?: User[]
  subscriptions?: Subscription[]
}

type StatusTab = 'pending' | 'active' | 'suspended'

type MandalsTabProps = {
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function MandalsTab({ showToast }: MandalsTabProps) {
  const [mandals, setMandals] = useState<Mandal[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedKyc, setExpandedKyc] = useState<string | null>(null)
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({})
  const [kycUpdating, setKycUpdating] = useState<string | null>(null)

  const tabs: StatusTab[] = ['pending', 'active', 'suspended']

  // Fetch mandals whenever tab changes
  useEffect(() => {
    fetchMandals(activeTab)
  }, [activeTab])

  async function fetchMandals(status: StatusTab) {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/mandals?status=${status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMandals(data.mandals || [])
    } catch (err) {
      showToast('Failed to load mandals', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(mandalId: string, action: 'approve' | 'reject' | 'suspend') {
    setActionLoading(mandalId)
    try {
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandalId, action, plan: 'trial' })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(data.message, 'success')
      // Remove the mandal from current list
      setMandals(prev => prev.filter(m => m.id !== mandalId))
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  async function getSignedUrl(path: string): Promise<string> {
    const { data } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(path, 60 * 60) // 1 hour
    return data?.signedUrl || ''
  }

  async function openDoc(path: string | null) {
    if (!path) return
    const url = await getSignedUrl(path)
    if (url) window.open(url, '_blank')
  }

  async function updateKycStatus(mandalId: string, status: 'in_review' | 'approved' | 'rejected') {
    setKycUpdating(mandalId)
    try {
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandalId,
          kycStatus: status,
          kycNotes: kycNotes[mandalId] || null
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`KYC marked as ${status}`, 'success')
      setMandals(prev => prev.map(m =>
        m.id === mandalId ? { ...m, kyc_status: status } : m
      ))
    } catch (err: any) {
      showToast(err.message || 'KYC update failed', 'error')
    } finally {
      setKycUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Mandal Registrations
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Review, approve, and manage registered community organization accounts.
          </p>
        </div>
      </div>

      {/* Tab Controls Selector */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                isActive
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Dynamic List Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          </div>
          <p className="text-[10px] text-gray-500 font-mono animate-pulse">Loading records...</p>
        </div>
      ) : mandals.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gray-800 text-gray-500 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-200">No {activeTab} mandals found</h3>
            <p className="text-xs text-gray-550 max-w-xs mx-auto">There are no community organizations matching this status.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mandals.map(mandal => {
            const admin = mandal.users?.find(u => u.role === 'admin')
            const subscription = mandal.subscriptions?.[0]
            const isActing = actionLoading === mandal.id

            return (
              <div 
                key={mandal.id} 
                className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-700 transition-all relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  mandal.status === 'pending' 
                    ? 'bg-amber-500' 
                    : mandal.status === 'active' 
                    ? 'bg-emerald-500' 
                    : 'bg-rose-500'
                }`} />

                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white leading-snug">{mandal.name}</h3>
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center space-x-1">
                        <span>Registered {formatDate(mandal.created_at)}</span>
                      </p>
                    </div>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border font-mono ${
                      mandal.status === 'pending' 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-505' 
                        : mandal.status === 'active' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                    }`}>
                      {mandal.status}
                    </span>
                  </div>

                  {/* Subscription details */}
                  {subscription && (
                    <div className="bg-gray-950 rounded-xl p-2.5 border border-gray-800 flex justify-between items-center text-[10px]">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-gray-400">Subscription:</span>
                        <span className="font-semibold text-gray-200 capitalize">{subscription.plan} Plan</span>
                      </div>
                      <span className="text-gray-500">
                        Ends {formatDate(subscription.ends_at || '')}
                      </span>
                    </div>
                  )}

                  {/* Grid info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="space-y-0.5">
                      <span className="text-gray-500 font-medium block text-[10px]">Location Info</span>
                      <p className="text-gray-200 font-semibold">{mandal.city || '—'}</p>
                      <p className="text-[11px] text-gray-400 leading-tight">{mandal.address || '—'}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-gray-500 font-medium block text-[10px]">Mandal Phone</span>
                      <p className="text-gray-200 font-semibold">{mandal.phone || '—'}</p>
                    </div>

                    <div className="space-y-0.5 sm:col-span-2 border-t border-gray-800 pt-2.5">
                      <span className="text-gray-500 font-medium block text-[10px]">Mandal Admin Account</span>
                      {admin ? (
                        <div className="flex flex-col sm:flex-row sm:justify-between text-gray-250 font-semibold mt-0.5 gap-1">
                          <span>{admin.full_name}</span>
                          <span className="text-gray-400 font-normal">Phone: {admin.phone}</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No admin account linked</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* KYC Documents Section */}
                {activeTab === 'pending' && (
                  <div className="border-t border-gray-850 pt-3 mt-3">
                    <button
                      onClick={() => setExpandedKyc(expandedKyc === mandal.id ? null : mandal.id)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-orange-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        KYC Documents
                        {mandal.kyc_status && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase
                            ${mandal.kyc_status === 'approved' ? 'bg-emerald-500/10 text-emerald-500'
                            : mandal.kyc_status === 'rejected' ? 'bg-rose-500/10 text-rose-500'
                            : mandal.kyc_status === 'in_review' ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-amber-500/10 text-amber-500'}`}>
                            {mandal.kyc_status}
                          </span>
                        )}
                      </span>
                      <span className={`transition-transform ${expandedKyc === mandal.id ? 'rotate-180' : ''}`}>▾</span>
                    </button>

                    {expandedKyc === mandal.id && (
                      <div className="mt-2.5 space-y-2.5 bg-gray-950/40 p-2.5 border border-gray-800 rounded-xl">
                        {/* Submitted details */}
                        <div className="text-[10px] space-y-1">
                          <p className="font-semibold text-gray-500 uppercase tracking-wide">Submitted details</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-300">
                            <div><span className="text-gray-500">Admin: </span>{mandal.admin_full_name || '—'}</div>
                            <div><span className="text-gray-500">Email: </span>{mandal.admin_email || '—'}</div>
                            <div><span className="text-gray-500">Phone: </span>{mandal.admin_phone || '—'}</div>
                            <div><span className="text-gray-500">UPI ID: </span>{mandal.upi_id || '—'}</div>
                            <div><span className="text-gray-500">Pincode: </span>{mandal.pincode || '—'}</div>
                          </div>
                        </div>

                        {/* Document links */}
                        <div className="space-y-1.5 border-t border-gray-800 pt-2.5">
                          {[
                            { key: 'doc_admin_aadhaar', label: 'Admin Aadhaar', required: true },
                            { key: 'doc_bank_proof', label: 'Bank Proof', required: true },
                            { key: 'doc_auth_letter', label: 'Auth Letter / Resolution', required: true },
                            { key: 'doc_address_proof', label: 'Address Proof', required: true },
                            { key: 'doc_reg_cert', label: 'Registration Certificate', required: false },
                            { key: 'doc_admin_pan', label: 'Admin PAN', required: false },
                            { key: 'doc_org_pan', label: 'Organisation PAN', required: false },
                          ].map(doc => {
                            const path = mandal[doc.key as keyof Mandal] as string | null
                            return (
                              <div key={doc.key} className="flex items-center justify-between text-[11px]">
                                <span className={`${doc.required ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {doc.label}
                                  {doc.required && <span className="text-rose-400 ml-0.5">*</span>}
                                </span>
                                {path ? (
                                  <button
                                    onClick={() => openDoc(path)}
                                    className="text-orange-400 hover:text-orange-500 font-semibold flex items-center gap-0.5"
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className={`${doc.required ? 'text-rose-400 font-medium' : 'text-gray-500'}`}>
                                    {doc.required ? 'Missing' : 'Not provided'}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* KYC Notes */}
                        <textarea
                          value={kycNotes[mandal.id] || mandal.kyc_notes || ''}
                          onChange={e => setKycNotes(prev => ({ ...prev, [mandal.id]: e.target.value }))}
                          placeholder="Add review notes (optional)..."
                          rows={2}
                          className="w-full text-xs bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-250 placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
                        />

                        {/* KYC action buttons */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => updateKycStatus(mandal.id, 'in_review')}
                            disabled={kycUpdating === mandal.id || mandal.kyc_status === 'in_review'}
                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
                          >
                            In Review
                          </button>
                          <button
                            onClick={() => updateKycStatus(mandal.id, 'approved')}
                            disabled={kycUpdating === mandal.id || mandal.kyc_status === 'approved'}
                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateKycStatus(mandal.id, 'rejected')}
                            disabled={kycUpdating === mandal.id || mandal.kyc_status === 'rejected'}
                            className="flex-1 py-1.5 text-[10px] font-bold rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-455 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex gap-2.5 pt-3 border-t border-gray-800 mt-4">
                  {activeTab === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleAction(mandal.id, 'approve')} 
                        disabled={isActing} 
                        className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        {isActing ? <span>Processing...</span> : <span>Approve Mandal</span>}
                      </button>
                      
                      <button 
                        onClick={() => handleAction(mandal.id, 'reject')} 
                        disabled={isActing} 
                        className="py-2 px-3 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/50 text-rose-400 disabled:opacity-50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {activeTab === 'active' && (
                    <button 
                      onClick={() => handleAction(mandal.id, 'suspend')} 
                      disabled={isActing} 
                      className="flex-1 py-2 px-3 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/50 text-rose-400 disabled:opacity-50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    >
                      {isActing ? <span>Processing...</span> : <span>Suspend Mandal</span>}
                    </button>
                  )}

                  {activeTab === 'suspended' && (
                    <button 
                      onClick={() => handleAction(mandal.id, 'approve')} 
                      disabled={isActing} 
                      className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    >
                      {isActing ? <span>Processing...</span> : <span>Reactivate Mandal</span>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
