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

type AllOrganizationsTabProps = {
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

export default function AllOrganizationsTab({ showToast }: AllOrganizationsTabProps) {
  const [organizations, setOrganizations] = useState<Mandal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)

  const [selectedDocKey, setSelectedDocKey] = useState('')
  const [selectedDocUrl, setSelectedDocUrl] = useState('')
  const [selectedDocLabel, setSelectedDocLabel] = useState('')
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const [detailedUser, setDetailedUser] = useState<any | null>(null)
  const [loadingDetailedUser, setLoadingDetailedUser] = useState(false)
  const [showDetailedUserModal, setShowDetailedUserModal] = useState(false)

  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)

  // Create organization modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mandalName, setMandalName] = useState('')
  const [mandalAddress, setMandalAddress] = useState('')
  const [mandalCity, setMandalCity] = useState('')
  const [mandalPincode, setMandalPincode] = useState('')
  const [mandalPhone, setMandalPhone] = useState('')
  const [mandalUpiId, setMandalUpiId] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('Welcome@123')
  const [autoApprove, setAutoApprove] = useState(true)

  // View organization details modal state
  const [viewingOrg, setViewingOrg] = useState<Mandal | null>(null)

  // Document preview sub-window modal state
  const [previewDoc, setPreviewDoc] = useState<{
    mandalId: string
    key: string
    label: string
    url: string
  } | null>(null)

  const [orgEvents, setOrgEvents] = useState<any[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDocKey('')
    setSelectedDocUrl('')
    setSelectedDocLabel('')

    if (viewingOrg) {
      fetchOrgEvents(viewingOrg.id)
    } else {
      setOrgEvents([])
    }
  }, [viewingOrg])

  async function fetchOrgEvents(mandalId: string) {
    setLoadingEvents(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/super-admin/events?mandal_id=${mandalId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOrgEvents(data.events || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization events', 'error')
    } finally {
      setLoadingEvents(false)
    }
  }

  async function handleToggleSuspendEvent(eventId: string, currentSuspended: boolean) {
    setTogglingEventId(eventId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/super-admin/events`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ eventId, isSuspended: !currentSuspended })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast(data.message || 'Event status updated', 'success')
      // Update local state
      setOrgEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_suspended: !currentSuspended, is_active: !currentSuspended ? false : e.is_active } : e))
    } catch (err: any) {
      showToast(err.message || 'Failed to update event status', 'error')
    } finally {
      setTogglingEventId(null)
    }
  }

  async function handleViewDoc(mandalId: string, docKey: string, label: string, path: string | null) {
    if (!path) {
      setPreviewDoc({ mandalId, key: docKey, label, url: '' })
      return
    }
    
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 300)
        
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not sign file URL')
      setPreviewDoc({ mandalId, key: docKey, label, url: data.signedUrl })
    } catch (err: any) {
      showToast('Error opening file: ' + err.message, 'error')
    }
  }

  async function selectDocument(docKey: string, label: string, path: string) {
    setSelectedDocKey(docKey)
    setSelectedDocLabel(label)
    setSelectedDocUrl('') // Reset while loading
    
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 300)
        
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not sign file URL')
      setSelectedDocUrl(data.signedUrl)
    } catch (err: any) {
      showToast('Error loading file: ' + err.message, 'error')
    }
  }

  const triggerUpload = (docKey: string) => {
    setUploadingDocKey(docKey)
    const input = document.getElementById('super-admin-doc-uploader') as HTMLInputElement
    if (input) {
      input.value = ''
      input.click()
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingDocKey || !viewingOrg) return

    setUploadingFile(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${viewingOrg.id}/${uploadingDocKey}.${ext}`

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, { upsert: true })

      if (uploadError) throw new Error(`Upload error: ${uploadError.message}`)

      // 2. Update DB via PATCH api
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mandalId: viewingOrg.id,
          documentKey: uploadingDocKey,
          documentPath: path
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast('Document uploaded successfully!', 'success')

      // 3. Update state locally
      const updatedOrg = {
        ...viewingOrg,
        [uploadingDocKey]: path
      }
      setOrganizations(prev => prev.map(org => org.id === viewingOrg.id ? updatedOrg : org))
      setViewingOrg(updatedOrg)

      // Auto-preview the uploaded file
      selectDocument(uploadingDocKey, uploadingDocKey, path)
    } catch (err: any) {
      showToast(err.message || 'Failed to upload document', 'error')
    } finally {
      setUploadingFile(false)
      setUploadingDocKey(null)
    }
  }

  async function fetchUserDetailedInfo(userId: string) {
    setLoadingDetailedUser(true)
    setShowDetailedUserModal(true)
    setDetailedUser(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`/api/super-admin/users/${userId}`, { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDetailedUser(data.user)
    } catch (err: any) {
      showToast(err.message || 'Failed to load user details', 'error')
      setShowDetailedUserModal(false)
    } finally {
      setLoadingDetailedUser(false)
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetPasswordUserId || newPasswordValue.length < 8) return

    setResettingPassword(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/super-admin/users/${resetPasswordUserId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password: newPasswordValue })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast('Password updated successfully!', 'success')
      setResetPasswordUserId(null)
      setNewPasswordValue('')

      if (detailedUser && detailedUser.id === resetPasswordUserId) {
        setDetailedUser((prev: any) => prev ? { ...prev, password_change: new Date().toISOString() } : prev)
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error')
    } finally {
      setResettingPassword(false)
    }
  }

  useEffect(() => {
    fetchAllOrganizations()
  }, [])

  useEffect(() => {
    setVisibleCount(10)
  }, [searchQuery])

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault()
    
    if (!mandalName.trim()) { showToast('Organization name is required', 'error'); return }
    if (!mandalPhone.trim()) { showToast('Mandal phone is required', 'error'); return }
    if (!mandalAddress.trim()) { showToast('Address is required', 'error'); return }
    if (!mandalCity.trim()) { showToast('City is required', 'error'); return }
    if (!mandalPincode.trim() || mandalPincode.length < 6) { showToast('Please enter a valid 6-digit pincode', 'error'); return }
    if (!adminName.trim()) { showToast('Admin full name is required', 'error'); return }
    if (!adminEmail.trim()) { showToast('Admin email is required', 'error'); return }
    if (!adminPassword.trim() || adminPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }

    setCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/super-admin/mandals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: mandalName.trim(),
          address: mandalAddress.trim(),
          city: mandalCity.trim(),
          pincode: mandalPincode.trim(),
          phone: mandalPhone.trim(),
          upiId: mandalUpiId.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword,
          autoApprove
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast('Organization created successfully', 'success')
      
      // Reset form states
      setMandalName('')
      setMandalAddress('')
      setMandalCity('')
      setMandalPincode('')
      setMandalPhone('')
      setMandalUpiId('')
      setAdminName('')
      setAdminEmail('')
      setAdminPassword('Welcome@123')
      setAutoApprove(true)
      setShowCreateModal(false)
      
      fetchAllOrganizations()
    } catch (err: any) {
      showToast(err.message || 'Failed to create organization', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function fetchAllOrganizations() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch('/api/super-admin/mandals?status=all', { headers })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOrganizations(data.mandals || [])
      setVisibleCount(10)
    } catch (err: any) {
      showToast(err.message || 'Failed to load organizations', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 50 // px from bottom
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= threshold) {
      if (visibleCount < filteredOrgs.length) {
        setVisibleCount(prev => Math.min(prev + 10, filteredOrgs.length))
      }
    }
  }

  // Filter local rows matching search query
  const filteredOrgs = organizations.filter(org => {
    const q = searchQuery.toLowerCase()
    return (
      org.name.toLowerCase().includes(q) ||
      (org.city || '').toLowerCase().includes(q) ||
      (org.phone || '').toLowerCase().includes(q) ||
      (org.admin_full_name || '').toLowerCase().includes(q)
    )
  })

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Count stats
  const totalCount = organizations.length
  const activeCount = organizations.filter(o => o.status === 'active').length
  const pendingCount = organizations.filter(o => o.status === 'pending' && o.kyc_status !== 'rejected').length
  const rejectedCount = organizations.filter(o => o.kyc_status === 'rejected').length
  const suspendedCount = organizations.filter(o => o.status === 'suspended').length

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-black text-white">All Registered Organizations</h2>
        <p className="text-xs text-gray-400 mt-1">List of all communities registered on Intellidon sorted alphabetically by name.</p>
      </div>

      {/* Grid Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Orgs</p>
          <p className="text-xl font-black text-white">{totalCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Active Orgs</p>
          <p className="text-xl font-black text-emerald-450">{activeCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Pending KYC</p>
          <p className="text-xl font-black text-amber-450">{pendingCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Rejected</p>
          <p className="text-xl font-black text-rose-455">{rejectedCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Suspended</p>
          <p className="text-xl font-black text-gray-400">{suspendedCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="w-full sm:max-w-md relative">
          <input
            type="text"
            placeholder="Search by name, city, phone, or admin..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 focus:border-orange-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-[10px] text-gray-500 hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-orange-500 hover:bg-orange-600 font-bold rounded-xl text-xs text-white cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/10"
          >
            ➕ Add Organization
          </button>
          <button 
            onClick={fetchAllOrganizations}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 font-bold rounded-xl text-xs text-gray-300 hover:text-white cursor-pointer transition-colors flex items-center justify-center gap-1.5"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* Main List Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          <p className="text-[10px] text-gray-500 font-mono animate-pulse">Loading records...</p>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center space-y-3">
          <p className="text-xs text-gray-550">No organizations found matching your search criteria.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div 
            className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-gray-900 z-10 border-b border-gray-800">
                <tr className="border-b border-gray-800 text-[10px] text-gray-550 uppercase tracking-wider font-bold bg-gray-950/20">
                  <th className="py-3.5 px-5 bg-gray-900">Organization Name</th>
                  <th className="py-3.5 px-5 bg-gray-900">Location</th>
                  <th className="py-3.5 px-5 bg-gray-900">Contacts</th>
                  <th className="py-3.5 px-5 bg-gray-900 text-center">Status</th>
                  <th className="py-3.5 px-5 bg-gray-900 text-center">KYC Status</th>
                  <th className="py-3.5 px-5 bg-gray-900">Subscription</th>
                  <th className="py-3.5 px-5 bg-gray-900">Created At</th>
                  <th className="py-3.5 px-5 bg-gray-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850 text-xs">
                {filteredOrgs.slice(0, visibleCount).map(org => {
                  const sub = org.subscriptions?.[0]
                  return (
                    <tr key={org.id} className="hover:bg-gray-850/20 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-5 font-bold text-white">
                        {org.name}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-5 text-gray-300">
                        {org.city || '—'}
                        {org.pincode && <span className="text-[10px] text-gray-500 block">{org.pincode}</span>}
                      </td>

                      {/* Contacts */}
                      <td className="py-3.5 px-5 text-gray-300 space-y-0.5">
                        <div className="text-[11px]">{org.phone || '—'}</div>
                        <div className="text-[10px] text-gray-550">Admin: {org.admin_full_name || '—'}</div>
                      </td>

                      {/* Mandal Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border
                          ${org.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : org.status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {org.status}
                        </span>
                      </td>

                      {/* KYC Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border
                          ${org.kyc_status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : org.kyc_status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {org.kyc_status || 'pending'}
                        </span>
                      </td>

                      {/* Active Subscription */}
                      <td className="py-3.5 px-5">
                        {sub ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-gray-200 capitalize">{sub.plan} Plan</span>
                            {sub.ends_at && (
                              <span className="text-[9px] text-gray-500 block">Expires {formatDate(sub.ends_at)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">No active plan</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-5 text-gray-400">
                        {formatDate(org.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setViewingOrg(org)}
                          className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600 text-gray-305 font-bold rounded-xl text-[10px] transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Organization Modal Pop-up Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
              <div>
                <h3 className="text-base font-bold text-white">Create New Organization</h3>
                <p className="text-xs text-gray-400 mt-0.5">Fill in details to instantly register and configure a new mandal profile.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white text-xs p-1"
              >
                ✕ Close
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrganization} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Section 1: Mandal Profile Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">1. Organization Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Organization Name *</label>
                    <input 
                      type="text" 
                      value={mandalName} 
                      onChange={e => setMandalName(e.target.value)}
                      required
                      placeholder="e.g. Shree Ganesh Mitra Mandal"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Mandal Phone *</label>
                    <input 
                      type="text" 
                      value={mandalPhone} 
                      onChange={e => setMandalPhone(e.target.value)}
                      required
                      placeholder="10-digit number"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-605 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">UPI ID (optional)</label>
                    <input 
                      type="text" 
                      value={mandalUpiId} 
                      onChange={e => setMandalUpiId(e.target.value)}
                      placeholder="e.g. mandal@upi"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-605 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Address *</label>
                    <input 
                      type="text" 
                      value={mandalAddress} 
                      onChange={e => setMandalAddress(e.target.value)}
                      required
                      placeholder="Street, area details"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">City *</label>
                    <input 
                      type="text" 
                      value={mandalCity} 
                      onChange={e => setMandalCity(e.target.value)}
                      required
                      placeholder="e.g. Mumbai"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Pincode *</label>
                    <input 
                      type="text" 
                      value={mandalPincode} 
                      onChange={e => setMandalPincode(e.target.value)}
                      required
                      placeholder="6-digit pincode"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Administrator Credentials */}
              <div className="space-y-4 border-t border-gray-800 pt-5">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">2. Admin User Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Full Name *</label>
                    <input 
                      type="text" 
                      value={adminName} 
                      onChange={e => setAdminName(e.target.value)}
                      required
                      placeholder="Full Name"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Email *</label>
                    <input 
                      type="email" 
                      value={adminEmail} 
                      onChange={e => setAdminEmail(e.target.value)}
                      required
                      placeholder="admin@email.com"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Password *</label>
                    <input 
                      type="text" 
                      value={adminPassword} 
                      onChange={e => setAdminPassword(e.target.value)}
                      required
                      placeholder="Min 8 characters"
                      className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Activation Preferences */}
              <div className="space-y-3 border-t border-gray-800 pt-5">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">3. Activation Settings</h4>
                <label className="flex items-start gap-3 bg-gray-955/60 p-4 border border-gray-850 rounded-xl cursor-pointer hover:bg-gray-955/80 transition-colors">
                  <input 
                    type="checkbox"
                    checked={autoApprove}
                    onChange={e => setAutoApprove(e.target.checked)}
                    className="mt-1 cursor-pointer accent-orange-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">Auto-Approve KYC & Activate immediately</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Bypasses document uploads and activates the account with a 30-day trial subscription immediately.
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-800 pt-5 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-gray-805 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating Organization...' : 'Create Organization'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingOrg && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/20">
              <div>
                <h3 className="text-base font-bold text-white">{viewingOrg.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Organization Details, Admins, Team Users, and KYC documents.</p>
              </div>
              <button 
                onClick={() => setViewingOrg(null)}
                className="text-gray-400 hover:text-white text-xs p-1"
              >
                ✕ Close
              </button>
            </div>

            {/* Scrollable details content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Grid 1: Basic Registration Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-950/30 p-4 border border-gray-850 rounded-xl text-xs">
                <div className="md:col-span-2 pb-2 border-b border-gray-800 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider">1. Profile & Registration Details</h4>
                  <span className="text-[10px] text-gray-500 font-mono">Registered on {formatDate(viewingOrg.created_at)}</span>
                </div>
                <div><span className="text-gray-500">Mandal Name: </span><span className="text-white font-semibold">{viewingOrg.name}</span></div>
                <div><span className="text-gray-500">Slug URL: </span><span className="text-gray-300 font-mono">/donate/{viewingOrg.slug}</span></div>
                <div><span className="text-gray-500">Mandal Phone: </span><span className="text-gray-300 font-mono">{viewingOrg.phone || '—'}</span></div>
                <div><span className="text-gray-500">UPI ID for Donations: </span><span className="text-gray-300 font-mono">{viewingOrg.upi_id || '—'}</span></div>
                <div className="md:col-span-2"><span className="text-gray-500">Address: </span><span className="text-gray-300">{viewingOrg.address || '—'}, {viewingOrg.city || '—'} - {viewingOrg.pincode || '—'}</span></div>
              </div>

              {/* Grid 2: Account Administrator */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-955/30 p-4 border border-gray-850 rounded-xl text-xs">
                <div className="md:col-span-3 pb-2 border-b border-gray-800 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider">2. Account Administrator</h4>
                  {viewingOrg.users?.find(u => u.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => setResetPasswordUserId(viewingOrg.users?.find(u => u.role === 'admin')?.id || null)}
                      className="px-2.5 py-1 bg-gray-850 hover:bg-gray-800 hover:text-white border border-gray-750 hover:border-gray-700 text-orange-400 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                    >
                      Change Password
                    </button>
                  )}
                </div>
                <div><span className="text-gray-500">Admin Name: </span><span className="text-white font-semibold">{viewingOrg.admin_full_name || '—'}</span></div>
                <div><span className="text-gray-500">Login Email: </span><span className="text-gray-300 font-mono">{viewingOrg.admin_email || '—'}</span></div>
                <div><span className="text-gray-500">Admin Phone: </span><span className="text-gray-300 font-mono">{viewingOrg.admin_phone || '—'}</span></div>
              </div>

              {/* Section 3: Documents (New layout with inline viewer and row buttons) */}
              <div className="space-y-3 bg-gray-950/20 border border-gray-850 rounded-xl p-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">3. Documents</h4>
                
                <div className="flex flex-wrap gap-2.5 items-center">
                  {[
                    { key: 'doc_admin_aadhaar', label: 'Aadhaar' },
                    { key: 'doc_bank_proof', label: 'Bank Proof' },
                    { key: 'doc_auth_letter', label: 'Auth Letter' },
                    { key: 'doc_address_proof', label: 'Address Proof' },
                    { key: 'doc_reg_cert', label: 'Reg Certificate' },
                    { key: 'doc_admin_pan', label: 'Admin PAN' },
                    { key: 'doc_org_pan', label: 'Org PAN' }
                  ].map(doc => {
                    const path = viewingOrg[doc.key as keyof Mandal] as string | null
                    const isMissing = !path

                    if (isMissing) {
                      return (
                        <div key={doc.key} className="flex items-center gap-1.5 bg-gray-955/40 px-2.5 py-1.5 border border-dashed border-gray-800 rounded-xl text-[11px]">
                          <span className="text-gray-500 font-semibold">{doc.label} (No attachment)</span>
                          <button
                            type="button"
                            onClick={() => triggerUpload(doc.key)}
                            disabled={uploadingFile && uploadingDocKey === doc.key}
                            className="px-2 py-0.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold rounded text-[9px] border border-orange-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {uploadingFile && uploadingDocKey === doc.key ? 'Uploading...' : 'Upload Now'}
                          </button>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={doc.key}
                        type="button"
                        onClick={() => selectDocument(doc.key, doc.label, path)}
                        className={`px-3 py-1.5 font-bold rounded-xl text-xs border transition-colors cursor-pointer
                          ${selectedDocKey === doc.key
                            ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/10'
                            : 'bg-gray-800 border-gray-750 hover:bg-gray-750 hover:border-gray-700 text-gray-300 hover:text-white'}`}
                      >
                        📄 {doc.label}
                      </button>
                    )
                  })}
                </div>

                {/* Inline document preview box */}
                {selectedDocUrl ? (
                  <div className="mt-4 border border-gray-800 rounded-xl overflow-hidden bg-gray-955 h-[350px] relative">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(selectedDocUrl, '_blank')}
                        className="px-2.5 py-1 bg-gray-900/80 hover:bg-gray-800/90 text-gray-300 rounded text-[9px] font-bold border border-gray-750 transition-colors cursor-pointer"
                      >
                        External ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocUrl('')
                          setSelectedDocKey('')
                        }}
                        className="px-2.5 py-1 bg-gray-900/80 hover:bg-gray-800/90 text-gray-300 rounded text-[9px] font-bold border border-gray-750 transition-colors cursor-pointer"
                      >
                        Close Preview ✕
                      </button>
                    </div>
                    
                    {selectedDocUrl.includes('.pdf') || selectedDocUrl.toLowerCase().indexOf('pdf') !== -1 ? (
                      <iframe
                        src={selectedDocUrl}
                        className="w-full h-full border-0"
                        title={selectedDocLabel}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <img
                          src={selectedDocUrl}
                          alt={selectedDocLabel}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                      </div>
                    )}
                  </div>
                ) : selectedDocKey ? (
                  <div className="mt-4 border border-gray-850 rounded-xl bg-gray-950 h-[100px] flex items-center justify-center text-xs text-gray-550 font-mono">
                    <div className="w-5 h-5 rounded-full border border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin mr-2" />
                    Generating preview link...
                  </div>
                ) : null}
              </div>

              {/* Section 4: Team Members (moved after document section) */}
              <div className="space-y-3 bg-gray-950/20 border border-gray-850 rounded-xl p-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">4. Team Members ({viewingOrg.users?.length || 0})</h4>
                {(!viewingOrg.users || viewingOrg.users.length === 0) ? (
                  <p className="text-xs text-gray-550 italic">No registered team members found for this organization.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-[10px] text-gray-550 uppercase tracking-wider font-bold">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850 text-gray-300">
                        {viewingOrg.users.map(u => (
                          <tr key={u.id} className="hover:bg-gray-955/20">
                            <td className="py-2.5 px-3 font-semibold text-white">{u.full_name || '—'}</td>
                            <td className="py-2.5 px-3 font-mono">{u.phone || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                ${u.role === 'admin' 
                                  ? 'bg-amber-500/10 text-amber-450 border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => fetchUserDetailedInfo(u.id)}
                                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600 text-orange-400 hover:text-orange-500 font-bold rounded-xl text-[10px] transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 5: Events */}
              <div className="space-y-3 bg-gray-950/20 border border-gray-850 rounded-xl p-4">
                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider block">5. Organization Events ({orgEvents.length})</h4>
                {loadingEvents ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                    <div className="w-5 h-5 rounded-full border border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
                    <p className="text-[10px] text-gray-550 font-mono">Fetching events...</p>
                  </div>
                ) : orgEvents.length === 0 ? (
                  <p className="text-xs text-gray-550 italic">No events found for this organization.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-[10px] text-gray-550 uppercase tracking-wider font-bold">
                          <th className="py-2 px-3">Event Name</th>
                          <th className="py-2 px-3">UPI ID</th>
                          <th className="py-2 px-3">Dates</th>
                          <th className="py-2 px-3 text-center">Status</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850 text-gray-300">
                        {orgEvents.map(ev => {
                          const today = new Date().toISOString().split('T')[0]
                          const isExpired = ev.end_date < today
                          const isSuspended = ev.is_suspended

                          return (
                            <tr key={ev.id} className="hover:bg-gray-955/20">
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {ev.name} {ev.year}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{ev.upi_id || '—'}</td>
                              <td className="py-2.5 px-3 text-gray-400">
                                {ev.start_date} to {ev.end_date}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                  ${isSuspended
                                    ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                                    : isExpired
                                      ? 'bg-gray-550/10 text-gray-555 border-gray-550/20'
                                      : ev.is_active
                                        ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                  {isSuspended ? 'Suspended' : isExpired ? 'Expired' : ev.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuspendEvent(ev.id, !!ev.is_suspended)}
                                  disabled={togglingEventId === ev.id || isExpired}
                                  className={`px-3 py-1 font-bold rounded-lg text-[10px] transition-colors cursor-pointer border disabled:opacity-30 disabled:cursor-not-allowed
                                    ${isSuspended
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border-rose-500/20'}`}
                                >
                                  {togglingEventId === ev.id ? 'Updating...' : isSuspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-gray-850 flex justify-end bg-gray-955/20">
              <button
                type="button"
                onClick={() => setViewingOrg(null)}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub Window File Previewer Overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-955/20">
              <div>
                <h3 className="text-sm font-bold text-white">KYC Document Preview</h3>
                <p className="text-[10px] text-gray-500 font-mono tracking-wide mt-0.5">{previewDoc.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Content - Iframe or Image */}
            <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden p-2 relative">
              {previewDoc.url ? (
                previewDoc.url.includes('.pdf') || previewDoc.url.toLowerCase().indexOf('pdf') !== -1 ? (
                  <iframe 
                    src={previewDoc.url} 
                    className="w-full h-full border-0 rounded-lg"
                    title={previewDoc.label}
                  />
                ) : (
                  <img 
                    src={previewDoc.url} 
                    alt={previewDoc.label}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                )
              ) : (
                /* Falling back to Mock document view overlay */
                <div className="text-center p-8 space-y-4 max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center text-3xl mx-auto animate-bounce">
                    📄
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-white">Demo File (Mock Preview Mode)</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      No document path was attached to this mock registration. Displaying dummy placeholder contents for Super Admin preview validation.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-900 border border-gray-850 rounded-xl text-left text-[11px] font-mono text-gray-400 space-y-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">System Metadata</p>
                    <p>Mandal ID: {previewDoc.mandalId}</p>
                    <p>Field Key: {previewDoc.key}</p>
                    <p>Preview Timestamp: {new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Team Member Modal */}
      {showDetailedUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-955/20">
              <div>
                <h3 className="text-sm font-bold text-white">Team Member Profile</h3>
                <p className="text-[10px] text-gray-550 font-mono tracking-wide mt-0.5">Super Admin Audit View</p>
              </div>
              <button 
                onClick={() => setShowDetailedUserModal(false)}
                className="text-gray-400 hover:text-white text-xs p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {loadingDetailedUser ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <div className="w-6 h-6 rounded-full border border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
                  <p className="text-[10px] text-gray-500 font-mono">Fetching profile details...</p>
                </div>
              ) : detailedUser ? (
                <div className="space-y-4">
                  {/* Basic Card */}
                  <div className="bg-gray-955/50 border border-gray-850 p-4 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                      <div>
                        <p className="text-sm font-bold text-white">{detailedUser.full_name}</p>
                        <p className="text-[9px] text-orange-400 font-mono tracking-wider uppercase leading-none mt-0.5">
                          {detailedUser.designation}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                        ${detailedUser.is_active 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-455 border-rose-500/20'}`}>
                        {detailedUser.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-300">
                      <div>
                        <span className="text-gray-550 block text-[9px] font-semibold uppercase tracking-wider">Email Address</span>
                        <span className="font-mono text-white truncate block">{detailedUser.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-550 block text-[9px] font-semibold uppercase tracking-wider">Phone Number</span>
                        <span className="font-mono text-white block">{detailedUser.phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-550 block text-[9px] font-semibold uppercase tracking-wider">System Role</span>
                        <span className="capitalize block">{detailedUser.role}</span>
                      </div>
                      <div>
                        <span className="text-gray-550 block text-[9px] font-semibold uppercase tracking-wider">Joined Date</span>
                        <span>{detailedUser.created_at ? formatDate(detailedUser.created_at) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Security / Logs Card */}
                  <div className="bg-gray-955/50 border border-gray-850 p-4 rounded-xl space-y-2 text-[11px]">
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1.5 mb-2.5">
                      Security & Login Info
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-555">Last Login:</span>
                        <span className="font-mono text-white text-right">
                          {detailedUser.last_login ? new Date(detailedUser.last_login).toLocaleString('en-IN') : 'Never logged in'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-555">Profile / Password Update:</span>
                        <span className="font-mono text-white text-right">
                          {detailedUser.password_change ? new Date(detailedUser.password_change).toLocaleString('en-IN') : 'No password updates'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-800/40 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setResetPasswordUserId(detailedUser.id)}
                          className="px-2.5 py-1.5 bg-gray-850 hover:bg-gray-800 hover:text-white border border-gray-750 text-orange-400 font-bold rounded-lg text-[9px] transition-colors cursor-pointer"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collection Activity Card */}
                  <div className="bg-gray-955/50 border border-gray-850 p-4 rounded-xl space-y-2 text-[11px]">
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1.5 mb-2.5">
                      Collection Activity
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-gray-950/40 p-2.5 border border-gray-850 rounded-lg">
                        <p className="text-[9px] text-gray-550 font-bold uppercase tracking-wider">Total Collected</p>
                        <p className="text-xs font-black text-white mt-1">{detailedUser.activity.totalCount} donations</p>
                        <p className="text-[10px] font-mono text-gray-405 mt-0.5">₹{detailedUser.activity.totalAmount}</p>
                      </div>
                      <div className="bg-gray-950/40 p-2.5 border border-gray-850 rounded-lg">
                        <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Verified Cash</p>
                        <p className="text-xs font-black text-emerald-450 mt-1">{detailedUser.activity.verifiedCount} items</p>
                        <p className="text-[10px] font-mono text-emerald-400 mt-0.5">₹{detailedUser.activity.verifiedAmount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-555 text-center py-6">Could not load profile info.</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-850 bg-gray-955/20 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailedUserModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {resetPasswordUserId && (
        <div className="fixed inset-0 z-55 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-955/20">
              <div>
                <h3 className="text-sm font-bold text-white">Change User Password</h3>
                <p className="text-[10px] text-gray-555 font-mono mt-0.5">Admin Security Credential Update</p>
              </div>
              <button 
                onClick={() => {
                  setResetPasswordUserId(null)
                  setNewPasswordValue('')
                }}
                className="text-gray-400 hover:text-white text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordReset} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">New Password *</label>
                <input
                  type="text"
                  required
                  placeholder="Min 8 characters"
                  value={newPasswordValue}
                  onChange={e => setNewPasswordValue(e.target.value)}
                  className="w-full bg-gray-955 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordUserId(null)
                    setNewPasswordValue('')
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword || newPasswordValue.length < 8}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden File Uploader */}
      <input
        type="file"
        id="super-admin-doc-uploader"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={handleFileUpload}
      />

    </div>
  )
}
