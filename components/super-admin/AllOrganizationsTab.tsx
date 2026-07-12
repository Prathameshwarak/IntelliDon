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
  kyc_status: 'pending' | 'in_review' | 'approved' | 'rejected' | null
  users?: User[]
  subscriptions?: Subscription[]
}

type AllOrganizationsTabProps = {
  showToast: (message: string, type: 'success' | 'error') => void
}

export default function AllOrganizationsTab({ showToast }: AllOrganizationsTabProps) {
  const [organizations, setOrganizations] = useState<Mandal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

  useEffect(() => {
    fetchAllOrganizations()
  }, [])

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
      const res = await fetch('/api/super-admin/mandals?status=all')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOrganizations(data.mandals || [])
    } catch (err: any) {
      showToast(err.message || 'Failed to load organizations', 'error')
    } finally {
      setLoading(false)
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-wider font-bold bg-gray-950/20">
                  <th className="py-3.5 px-5">Organization Name</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Contacts</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-center">KYC Status</th>
                  <th className="py-3.5 px-5">Subscription</th>
                  <th className="py-3.5 px-5">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850 text-xs">
                {filteredOrgs.map(org => {
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

    </div>
  )
}
