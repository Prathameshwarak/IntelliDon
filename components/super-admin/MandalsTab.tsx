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

type StatusTab = 'pending' | 'active' | 'suspended' | 'rejected'

type MandalsTabProps = {
  showToast: (message: string, type: 'success' | 'error') => void
}

function parseKycNotes(rawNotes: string | null): { notes: string; documentStatuses: Record<string, 'approved' | 'rejected' | 'pending'> } {
  if (!rawNotes) {
    return { notes: '', documentStatuses: {} }
  }
  try {
    const parsed = JSON.parse(rawNotes)
    if (parsed && typeof parsed === 'object') {
      return {
        notes: parsed.notes || '',
        documentStatuses: parsed.documentStatuses || {}
      }
    }
  } catch (e) {
    // Treat as raw text note
  }
  return { notes: rawNotes, documentStatuses: {} }
}

export default function MandalsTab({ showToast }: MandalsTabProps) {
  const [mandals, setMandals] = useState<Mandal[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedKyc, setExpandedKyc] = useState<string | null>(null)
  
  // KYC specific states
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({})
  const [docStatuses, setDocStatuses] = useState<Record<string, Record<string, 'approved' | 'rejected' | 'pending'>>>({})
  const [kycUpdating, setKycUpdating] = useState<string | null>(null)
  
  // Sub Window Preview modal state
  const [previewDoc, setPreviewDoc] = useState<{
    mandalId: string
    key: string
    label: string
    url: string
  } | null>(null)

  const tabs: StatusTab[] = ['pending', 'active', 'suspended', 'rejected']

  // Fetch mandals whenever tab changes
  useEffect(() => {
    fetchMandals(activeTab)
  }, [activeTab])

  async function fetchMandals(status: StatusTab) {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`/api/super-admin/mandals?status=${status}`, { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const list = data.mandals || []
      setMandals(list)

      // Initialize states from notes
      const initialNotes: Record<string, string> = {}
      const initialDocStatuses: Record<string, Record<string, 'approved' | 'rejected' | 'pending'>> = {}
      list.forEach((m: Mandal) => {
        const parsed = parseKycNotes(m.kyc_notes)
        initialNotes[m.id] = parsed.notes
        initialDocStatuses[m.id] = parsed.documentStatuses
      })
      setKycNotes(initialNotes)
      setDocStatuses(initialDocStatuses)
    } catch (err) {
      showToast('Failed to load mandals', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(mandalId: string, action: 'approve' | 'reject' | 'suspend') {
    let kycNotesPayload: string | undefined = undefined

    if (action === 'reject') {
      const reason = prompt('Please enter the rejection reason for this organization:')
      if (reason === null) return // user cancelled
      if (!reason.trim()) {
        alert('Rejection reason is required.')
        return
      }
      kycNotesPayload = JSON.stringify({
        notes: reason.trim(),
        documentStatuses: docStatuses[mandalId] || {}
      })
    }

    setActionLoading(mandalId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          mandalId, 
          action, 
          plan: 'trial',
          kycNotes: kycNotesPayload
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      // Update local notes state so it displays immediately if they expand documents card
      if (kycNotesPayload) {
        const parsed = JSON.parse(kycNotesPayload)
        setKycNotes(prev => ({ ...prev, [mandalId]: parsed.notes }))
      }
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

  async function handleViewDoc(mandalId: string, docKey: string, docLabel: string, path: string | null) {
    if (!path) {
      // Force preview mock document since upload path is null
      setPreviewDoc({
        mandalId,
        key: docKey,
        label: `${docLabel} (Force Mock Preview)`,
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      })
      showToast('No uploaded file found. Loaded dummy placeholder.', 'success')
      return
    }
    try {
      const url = await getSignedUrl(path)
      if (url) {
        setPreviewDoc({
          mandalId,
          key: docKey,
          label: docLabel,
          url
        })
      } else {
        showToast('Could not fetch signed preview link', 'error')
      }
    } catch (err) {
      showToast('Could not fetch signed preview link', 'error')
    }
  }

  async function updateKycStatus(mandalId: string, status: 'in_review' | 'approved' | 'rejected') {
    setKycUpdating(mandalId)
    const payloadNotes = JSON.stringify({
      notes: kycNotes[mandalId] || '',
      documentStatuses: docStatuses[mandalId] || {}
    })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mandalId,
          kycStatus: status,
          kycNotes: payloadNotes
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`KYC marked as ${status}`, 'success')
      if (status === 'rejected' && activeTab === 'pending') {
        setMandals(prev => prev.filter(m => m.id !== mandalId))
      } else {
        setMandals(prev => prev.map(m =>
          m.id === mandalId ? { ...m, kyc_status: status, kyc_notes: payloadNotes } : m
        ))
      }
    } catch (err: any) {
      showToast(err.message || 'KYC update failed', 'error')
    } finally {
      setKycUpdating(null)
    }
  }

  async function saveDocReviews(mandalId: string) {
    setKycUpdating(mandalId)
    const payloadNotes = JSON.stringify({
      notes: kycNotes[mandalId] || '',
      documentStatuses: docStatuses[mandalId] || {}
    })
    
    // Maintain current status
    const currentMandal = mandals.find(m => m.id === mandalId)
    const kycStatus = currentMandal?.kyc_status || 'pending'

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mandalId,
          kycStatus,
          kycNotes: payloadNotes
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(`Document review statuses saved`, 'success')
      setMandals(prev => prev.map(m =>
        m.id === mandalId ? { ...m, kyc_notes: payloadNotes } : m
      ))
    } catch (err: any) {
      showToast(err.message || 'Failed to save review', 'error')
    } finally {
      setKycUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Sub Window Preview Overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <p className="font-semibold text-white text-sm">{previewDoc.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Mandal ID: {previewDoc.mandalId}</p>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)} 
                className="text-gray-500 hover:text-white text-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - Document Viewer */}
            <div className="flex-1 bg-gray-950 p-4 overflow-y-auto flex items-center justify-center min-h-[300px]">
              {previewDoc.url.includes('.png') || previewDoc.url.includes('.jpg') || previewDoc.url.includes('.jpeg') || previewDoc.url.includes('unsplash.com') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={previewDoc.url} 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md border border-gray-800" 
                  alt={previewDoc.label} 
                />
              ) : (
                <iframe 
                  src={previewDoc.url} 
                  className="w-full h-[60vh] bg-white rounded-lg border border-gray-800 shadow-md"
                  title={previewDoc.label}
                />
              )}
            </div>

            {/* Modal Footer - Approve / Reject Buttons */}
            <div className="px-5 py-4 border-t border-gray-800 bg-gray-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Status for this document:</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border
                  ${(docStatuses[previewDoc.mandalId]?.[previewDoc.key] || 'pending') === 'approved' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : (docStatuses[previewDoc.mandalId]?.[previewDoc.key] || 'pending') === 'rejected'
                    ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                  {docStatuses[previewDoc.mandalId]?.[previewDoc.key] || 'pending'}
                </span>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setDocStatuses(prev => ({
                      ...prev,
                      [previewDoc.mandalId]: {
                        ...(prev[previewDoc.mandalId] || {}),
                        [previewDoc.key]: 'approved'
                      }
                    }))
                    showToast('Document status set to approved', 'success')
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border
                    ${(docStatuses[previewDoc.mandalId]?.[previewDoc.key] || 'pending') === 'approved'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-gray-800 border-gray-700 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-600'}`}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => {
                    setDocStatuses(prev => ({
                      ...prev,
                      [previewDoc.mandalId]: {
                        ...(prev[previewDoc.mandalId] || {}),
                        [previewDoc.key]: 'rejected'
                      }
                    }))
                    showToast('Document status set to rejected', 'success')
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border
                    ${(docStatuses[previewDoc.mandalId]?.[previewDoc.key] || 'pending') === 'rejected'
                      ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                      : 'bg-rose-50 hover:bg-rose-100 dark:bg-gray-800 dark:hover:bg-rose-950/40 border-rose-200 dark:border-gray-700 text-rose-700 dark:text-rose-400'}`}
                >
                  ✕ Reject
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#1A1208] dark:text-white">
            Mandal Registrations
          </h2>
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1">
            Review, approve, and manage registered community organization accounts.
          </p>
        </div>
      </div>

      {/* Tab Controls Selector */}
      <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-1 w-fit">
        {tabs.map(tab => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20'
                  : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'
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
            <div className="absolute inset-0 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          </div>
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-mono animate-pulse">Loading records...</p>
        </div>
      ) : mandals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-gray-500 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1A1208] dark:text-gray-200">No {activeTab} mandals found</h3>
            <p className="text-xs text-[#7a6a55] dark:text-gray-500 max-w-xs mx-auto">There are no community organizations matching this status.</p>
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
                className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 flex flex-col justify-between hover:border-[#E8650A]/30 dark:hover:border-gray-700 transition-all relative overflow-hidden shadow-sm"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  mandal.kyc_status === 'rejected'
                    ? 'bg-rose-500'
                    : mandal.status === 'pending' 
                    ? 'bg-[#E8650A]' 
                    : mandal.status === 'active' 
                    ? 'bg-emerald-500' 
                    : 'bg-rose-500'
                }`} />

                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#1A1208] dark:text-white leading-snug">{mandal.name}</h3>
                      <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 mt-1 flex items-center space-x-1">
                        <span>Registered {formatDate(mandal.created_at)}</span>
                      </p>
                    </div>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border font-mono ${
                      mandal.kyc_status === 'rejected'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        : mandal.status === 'pending' 
                        ? 'bg-[#E8650A]/10 border-[#E8650A]/20 text-[#E8650A]' 
                        : mandal.status === 'active' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}>
                      {mandal.kyc_status === 'rejected' ? 'rejected' : mandal.status}
                    </span>
                  </div>

                  {/* Subscription details */}
                  {subscription && (
                    <div className="bg-[#F5EDE2] dark:bg-gray-950 rounded-xl p-2.5 border border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center text-[10px]">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[#7a6a55] dark:text-gray-400">Subscription:</span>
                        <span className="font-bold text-[#1A1208] dark:text-gray-200 capitalize">{subscription.plan} Plan</span>
                      </div>
                      <span className="text-[#7a6a55] dark:text-gray-500 font-medium">
                        Ends {formatDate(subscription.ends_at || '')}
                      </span>
                    </div>
                  )}

                  {/* Grid info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="space-y-0.5">
                      <span className="text-[#7a6a55] dark:text-gray-500 font-bold block text-[10px]">Location Info</span>
                      <p className="text-[#1A1208] dark:text-gray-200 font-bold">{mandal.city || '—'}</p>
                      <p className="text-[11px] text-[#7a6a55] dark:text-gray-400 leading-tight">{mandal.address || '—'}</p>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[#7a6a55] dark:text-gray-500 font-bold block text-[10px]">Mandal Phone</span>
                      <p className="text-[#1A1208] dark:text-gray-200 font-bold">{mandal.phone || '—'}</p>
                    </div>

                    <div className="space-y-0.5 sm:col-span-2 border-t border-[#1A1208]/10 dark:border-gray-800 pt-2.5">
                      <span className="text-[#7a6a55] dark:text-gray-500 font-bold block text-[10px]">Mandal Admin Account</span>
                      {admin ? (
                        <div className="flex flex-col sm:flex-row sm:justify-between text-[#1A1208] dark:text-gray-250 font-bold mt-0.5 gap-1">
                          <span>{admin.full_name}</span>
                          <span className="text-[#7a6a55] dark:text-gray-400 font-normal">Phone: {admin.phone}</span>
                        </div>
                      ) : (
                        <p className="text-[#7a6a55] dark:text-gray-500 italic">No admin account linked</p>
                      )}
                    </div>
                  </div>
                </div>


                {/* KYC Documents Section */}
                {activeTab === 'pending' && (
                  <div className="border-t border-[#1A1208]/10 dark:border-gray-800 pt-3 mt-3">
                    <button
                      onClick={() => setExpandedKyc(expandedKyc === mandal.id ? null : mandal.id)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-[#1A1208] dark:text-gray-300 hover:text-[#E8650A] transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        KYC Documents
                        {mandal.kyc_status && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase
                            ${mandal.kyc_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : mandal.kyc_status === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : mandal.kyc_status === 'in_review' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400'}`}>
                            {mandal.kyc_status}
                          </span>
                        )}
                      </span>
                      <span className={`transition-transform ${expandedKyc === mandal.id ? 'rotate-180' : ''}`}>▾</span>
                    </button>

                    {expandedKyc === mandal.id && (
                      <div className="mt-2.5 space-y-2.5 bg-[#F5EDE2]/60 dark:bg-gray-950/40 p-2.5 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                        {/* Submitted details */}
                        <div className="text-[10px] space-y-1">
                          <p className="font-extrabold text-[#7a6a55] dark:text-gray-500 uppercase tracking-wide">Submitted details</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[#1A1208] dark:text-gray-300 font-medium">
                            <div><span className="text-[#7a6a55] dark:text-gray-500">Admin: </span>{mandal.admin_full_name || '—'}</div>
                            <div><span className="text-[#7a6a55] dark:text-gray-500">Email: </span>{mandal.admin_email || '—'}</div>
                            <div><span className="text-[#7a6a55] dark:text-gray-500">Phone: </span>{mandal.admin_phone || '—'}</div>
                            <div><span className="text-[#7a6a55] dark:text-gray-500">UPI ID: </span>{mandal.upi_id || '—'}</div>
                            <div><span className="text-[#7a6a55] dark:text-gray-500">Pincode: </span>{mandal.pincode || '—'}</div>
                          </div>
                        </div>

                        {/* Document links */}
                        <div className="space-y-1.5 border-t border-[#1A1208]/10 dark:border-gray-800 pt-2.5">
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
                            const docStatus = docStatuses[mandal.id]?.[doc.key] || 'pending'
                            const isMissingOptional = !doc.required && !path

                            return (
                              <div key={doc.key} className="flex items-center justify-between text-[11px]">
                                <span className={`${doc.required ? 'text-[#1A1208] dark:text-gray-300 font-bold' : 'text-[#7a6a55] dark:text-gray-500'}`}>
                                  {doc.label}
                                  {doc.required && <span className="text-rose-500 ml-0.5">*</span>}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                  {isMissingOptional ? (
                                    <span className="text-[#7a6a55] dark:text-gray-500 text-[10px] italic pr-1 select-none font-medium">Not Attached</span>
                                  ) : (
                                    <>
                                      {/* Individual Doc Status Badge */}
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                        ${docStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                        : docStatus === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20'
                                        : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400 border-amber-500/20'}`}>
                                        {docStatus}
                                      </span>

                                      {/* View / Mock View Trigger */}
                                      <button
                                        onClick={() => handleViewDoc(mandal.id, doc.key, doc.label, path)}
                                        className={`font-bold text-xs transition-colors cursor-pointer
                                          ${path ? 'text-[#E8650A] dark:text-orange-400 hover:underline' : 'text-[#7a6a55] dark:text-gray-500 hover:text-gray-400 italic'}`}
                                      >
                                        {path ? 'View' : 'View (Mock)'}
                                      </button>

                                      {/* Quick Approve / Reject icons */}
                                      <div className="flex gap-1 ml-1">
                                        <button
                                          onClick={() => {
                                            setDocStatuses(prev => ({
                                              ...prev,
                                              [mandal.id]: {
                                                ...(prev[mandal.id] || {}),
                                                [doc.key]: 'approved'
                                              }
                                            }))
                                            showToast(`${doc.label} set to Approved`, 'success')
                                          }}
                                          title="Approve Document"
                                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition-colors cursor-pointer
                                            ${docStatus === 'approved'
                                              ? 'bg-emerald-600 border-emerald-500 text-white'
                                              : 'bg-white dark:bg-gray-800 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400 hover:bg-emerald-500/10 hover:border-emerald-600 hover:text-emerald-600'}`}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => {
                                            setDocStatuses(prev => ({
                                              ...prev,
                                              [mandal.id]: {
                                                ...(prev[mandal.id] || {}),
                                                [doc.key]: 'rejected'
                                              }
                                            }))
                                            showToast(`${doc.label} set to Rejected`, 'success')
                                          }}
                                          title="Reject Document"
                                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition-colors cursor-pointer
                                            ${docStatus === 'rejected'
                                              ? 'bg-rose-600 border-rose-500 text-white'
                                              : 'bg-white dark:bg-gray-800 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400 hover:bg-rose-500/10 hover:border-rose-600 hover:text-rose-600'}`}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* KYC Notes */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-bold uppercase tracking-wider block">Review Notes</label>
                          <textarea
                            value={kycNotes[mandal.id] || ''}
                            onChange={e => setKycNotes(prev => ({ ...prev, [mandal.id]: e.target.value }))}
                            placeholder="Add review notes (optional)..."
                            rows={2}
                            className="w-full text-xs bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-[#1A1208] dark:text-gray-250 placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] resize-none font-medium"
                          />
                        </div>

                        {/* KYC action buttons */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => saveDocReviews(mandal.id)}
                            disabled={kycUpdating === mandal.id}
                            className="w-full py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs border border-[#1A1208]/10 dark:border-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {kycUpdating === mandal.id ? 'Saving...' : 'Save Document Statuses'}
                          </button>
                          
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateKycStatus(mandal.id, 'in_review')}
                              disabled={kycUpdating === mandal.id || mandal.kyc_status === 'in_review'}
                              className="flex-1 py-2 text-[10px] font-bold rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              Mark In Review
                            </button>
                            <button
                              onClick={() => updateKycStatus(mandal.id, 'approved')}
                              disabled={kycUpdating === mandal.id || mandal.kyc_status === 'approved'}
                              className="flex-1 py-2 text-[10px] font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              Approve KYC
                            </button>
                            <button
                              onClick={() => updateKycStatus(mandal.id, 'rejected')}
                              disabled={kycUpdating === mandal.id || mandal.kyc_status === 'rejected'}
                              className="flex-1 py-2 text-[10px] font-bold rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-455 hover:bg-rose-500/20 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              Reject KYC
                            </button>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex gap-2.5 pt-3 border-t border-[#1A1208]/10 dark:border-gray-800 mt-4">
                  {activeTab === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleAction(mandal.id, 'approve')} 
                        disabled={isActing || mandal.kyc_status === 'rejected'} 
                        className="flex-1 py-2 px-3 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-md shadow-[#E8650A]/20"
                        title={mandal.kyc_status === 'rejected' ? 'Cannot approve until resubmitted' : undefined}
                      >
                        {isActing ? <span>Processing...</span> : <span>Approve Mandal</span>}
                      </button>
                      
                      <button 
                        onClick={() => handleAction(mandal.id, 'reject')} 
                        disabled={isActing || mandal.kyc_status === 'rejected'} 
                        className="py-2 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 disabled:opacity-50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {activeTab === 'rejected' && (
                    <div className="flex-1 text-center py-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-xl select-none">
                      🔒 Awaiting Resubmission (Cannot Approve)
                    </div>
                  )}

                  {activeTab === 'active' && (
                    <button 
                      onClick={() => handleAction(mandal.id, 'suspend')} 
                      disabled={isActing} 
                      className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 disabled:opacity-50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-sm"
                    >
                      {isActing ? <span>Processing...</span> : <span>Suspend Mandal</span>}
                    </button>
                  )}

                  {activeTab === 'suspended' && (
                    <button 
                      onClick={() => handleAction(mandal.id, 'approve')} 
                      disabled={isActing} 
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-md shadow-emerald-600/20"
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
