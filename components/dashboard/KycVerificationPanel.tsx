'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type KycVerificationPanelProps = {
  mandal: any
  userId: string
  showToast: (msg: string, type: 'success' | 'error') => void
  onResubmitSuccess: () => void
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
    // Return raw string note
  }
  return { notes: rawNotes, documentStatuses: {} }
}

export default function KycVerificationPanel({ mandal, userId, showToast, onResubmitSuccess }: KycVerificationPanelProps) {
  const parsed = parseKycNotes(mandal.kyc_notes)
  const [notes] = useState(parsed.notes)
  const [docStatuses] = useState(parsed.documentStatuses)
  const [resubmitting, setResubmitting] = useState(false)
  const [filesToUpload, setFilesToUpload] = useState<Record<string, File>>({})

  // Editable details states
  const [mandalName, setMandalName] = useState(mandal.name || '')
  const [mandalAddress, setMandalAddress] = useState(mandal.address || '')
  const [mandalCity, setMandalCity] = useState(mandal.city || '')
  const [mandalPincode, setMandalPincode] = useState(mandal.pincode || '')
  const [mandalPhone, setMandalPhone] = useState(mandal.phone || '')
  const [mandalUpiId, setMandalUpiId] = useState(mandal.upi_id || '')
  const [adminName, setAdminName] = useState(mandal.admin_full_name || '')
  const [adminPhone, setAdminPhone] = useState(mandal.admin_phone || '')

  const docFields = [
    { key: 'doc_admin_aadhaar', label: 'Admin Aadhaar *', required: true },
    { key: 'doc_bank_proof', label: 'Bank Proof (cheque/passbook) *', required: true },
    { key: 'doc_auth_letter', label: 'Auth Letter / Resolution *', required: true },
    { key: 'doc_address_proof', label: 'Address Proof *', required: true },
    { key: 'doc_reg_cert', label: 'Registration Certificate', required: false },
    { key: 'doc_admin_pan', label: 'Admin PAN', required: false },
    { key: 'doc_org_pan', label: 'Organisation PAN', required: false }
  ]

  const isKycRejected = mandal.kyc_status === 'rejected'
  
  // Re-uploadable fields are documents that are NOT approved
  const reuploadableFields = isKycRejected
    ? docFields.filter(doc => docStatuses[doc.key] !== 'approved')
    : []

  // List of fields that are explicitly rejected
  const rejectedFields = docFields.filter(doc => docStatuses[doc.key] === 'rejected')

  function handleFileChange(fieldName: string, file: File | null) {
    if (file) {
      setFilesToUpload(prev => ({ ...prev, [fieldName]: file }))
    } else {
      setFilesToUpload(prev => {
        const copy = { ...prev }
        delete copy[fieldName]
        return copy
      })
    }
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!mandalName.trim()) { showToast('Organization name is required', 'error'); return }
    if (!mandalPhone.trim()) { showToast('Mandal phone is required', 'error'); return }
    if (!mandalAddress.trim()) { showToast('Address is required', 'error'); return }
    if (!mandalCity.trim()) { showToast('City is required', 'error'); return }
    if (!mandalPincode.trim() || mandalPincode.length < 6) { showToast('Please enter a valid 6-digit pincode', 'error'); return }
    if (!adminName.trim()) { showToast('Admin full name is required', 'error'); return }
    if (!adminPhone.trim()) { showToast('Admin phone is required', 'error'); return }

    // Ensure all explicitly rejected files have a new file selected
    const missingSelections = rejectedFields.filter(f => !filesToUpload[f.key])
    if (missingSelections.length > 0) {
      showToast(`Please select new files for: ${missingSelections.map(m => m.label).join(', ')}`, 'error')
      return
    }

    setResubmitting(true)
    try {
      const fd = new FormData()
      fd.append('mandal_id', mandal.id)
      fd.append('user_id', userId)
      
      // Append updated textual details
      fd.append('name', mandalName.trim())
      fd.append('address', mandalAddress.trim())
      fd.append('city', mandalCity.trim())
      fd.append('pincode', mandalPincode.trim())
      fd.append('phone', mandalPhone.trim())
      fd.append('upi_id', mandalUpiId.trim())
      fd.append('admin_name', adminName.trim())
      fd.append('admin_phone', adminPhone.trim())
      
      Object.entries(filesToUpload).forEach(([key, file]) => {
        fd.append(key, file)
      })

      const res = await fetch('/api/mandals/kyc-resubmit', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()

      if (data.success) {
        showToast('Verification resubmitted successfully!', 'success')
        setFilesToUpload({})
        onResubmitSuccess()
      } else {
        showToast(data.error || 'Resubmission failed', 'error')
      }
    } catch (err) {
      showToast('Something went wrong during resubmission', 'error')
    }
    setResubmitting(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      {/* Header bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between border-b border-gray-900 pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="text-white font-black text-base italic">i</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">Intellidon</h1>
            <p className="text-[9px] text-orange-400 font-mono tracking-wider uppercase leading-none mt-0.5">Verification Hub</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="text-[10px] font-bold py-1.5 px-3 border border-gray-850 hover:border-gray-700 bg-gray-900 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          Sign Out
        </button>
      </header>

      {/* Main Content Card Container */}
      <main className="w-full max-w-2xl mx-auto my-8 bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between">
        
        {/* Status Line Indicator */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          mandal.kyc_status === 'rejected' 
            ? 'bg-rose-500'
            : mandal.kyc_status === 'in_review'
            ? 'bg-blue-500 animate-pulse'
            : 'bg-amber-500'
        }`} />

        <div className="space-y-6">
          {/* Organization metadata */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">{mandal.name}</h2>
              <p className="text-xs text-gray-400 mt-1">Status: Mandal Registration Review</p>
            </div>
            
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase border font-mono tracking-wide ${
              mandal.kyc_status === 'rejected' 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-455' 
                : mandal.kyc_status === 'in_review'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse'
            }`}>
              {mandal.kyc_status === 'in_review' ? 'In Review' : mandal.kyc_status === 'rejected' ? 'Rejected' : 'Pending Verification'}
            </span>
          </div>

          {/* Verification Details Box */}
          <div className="bg-gray-950/60 rounded-2xl p-5 border border-gray-850 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Verification Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500 font-medium">Expected Time Frame</span>
                <p className="text-orange-400 font-bold text-sm">6 - 12 Hours</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500 font-medium">Review Priority</span>
                <p className="text-gray-300 font-semibold">Standard Administrative Audit</p>
              </div>
            </div>

            {/* Notes / Reason alert if rejected or standard details */}
            {notes && (
              <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
                mandal.kyc_status === 'rejected'
                  ? 'bg-rose-950/15 border-rose-900/30 text-rose-300'
                  : 'bg-gray-900 border-gray-800 text-gray-300'
              }`}>
                <p className="font-bold text-[10px] uppercase tracking-wide mb-1 opacity-75">
                  {mandal.kyc_status === 'rejected' ? 'Rejection Reason' : 'Auditor Notes'}
                </p>
                <p>{notes}</p>
              </div>
            )}
          </div>

          {/* List of document verification states */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Document Verification States</h3>
            
            <div className="space-y-2">
              {docFields.map(doc => {
                const status = docStatuses[doc.key] || 'pending'
                const hasPath = !!mandal[doc.key]
                return (
                  <div 
                    key={doc.key} 
                    className="flex justify-between items-center p-3 bg-gray-950/30 border border-gray-850 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-medium text-gray-300">{doc.label}</span>
                      <span className="text-[10px] text-gray-500 block">
                        {hasPath ? 'Document Uploaded' : doc.required ? 'Required Document Missing' : 'Optional Document'}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border
                      ${status === 'approved' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : status === 'rejected'
                        ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-405 border-amber-500/20'}`}>
                      {status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Form to resubmit documents / details if KYC is rejected */}
          {isKycRejected && (
            <form onSubmit={handleResubmit} className="border-t border-gray-850 pt-5 mt-5 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Resubmit Details & Documents</h3>
                <p className="text-xs text-gray-400">
                  Correct any rejected details or documents below. Approved documents are locked and cannot be changed.
                </p>
              </div>

              {/* Organization Text Details Fields Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider block">1. Update Registration Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-950/40 p-4 border border-gray-850 rounded-xl">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Organization Name *</label>
                    <input 
                      type="text" 
                      value={mandalName} 
                      onChange={e => setMandalName(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Mandal Phone *</label>
                    <input 
                      type="text" 
                      value={mandalPhone} 
                      onChange={e => setMandalPhone(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-605 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">UPI ID</label>
                    <input 
                      type="text" 
                      value={mandalUpiId} 
                      onChange={e => setMandalUpiId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-605 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Address *</label>
                    <input 
                      type="text" 
                      value={mandalAddress} 
                      onChange={e => setMandalAddress(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">City *</label>
                    <input 
                      type="text" 
                      value={mandalCity} 
                      onChange={e => setMandalCity(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Pincode *</label>
                    <input 
                      type="text" 
                      value={mandalPincode} 
                      onChange={e => setMandalPincode(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Full Name *</label>
                    <input 
                      type="text" 
                      value={adminName} 
                      onChange={e => setAdminName(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Admin Phone *</label>
                    <input 
                      type="text" 
                      value={adminPhone} 
                      onChange={e => setAdminPhone(e.target.value)}
                      required
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Document upload fields (only if there are re-uploadable files) */}
              {reuploadableFields.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider block">2. Replace Rejected Documents</h4>
                  <div className="space-y-3">
                    {reuploadableFields.map(doc => {
                      const status = docStatuses[doc.key] || 'pending'
                      return (
                        <div key={doc.key} className="bg-gray-950/60 p-4 border border-gray-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-gray-305">{doc.label}</label>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border
                              ${status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {status === 'rejected' ? 'Rejected' : 'Not Audited'}
                            </span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg, application/pdf"
                            onChange={e => handleFileChange(doc.key, e.target.files?.[0] || null)}
                            className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-orange-500/10 file:text-orange-400 hover:file:bg-orange-500/20 cursor-pointer file:cursor-pointer"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={resubmitting}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center"
              >
                {resubmitting ? 'Submitting Revisions...' : 'Resubmit KYC Profile for Review'}
              </button>
            </form>
          )}

        </div>

      </main>

      {/* Footer copyright and security */}
      <footer className="w-full max-w-2xl mx-auto border-t border-gray-900 pt-5 text-center text-[10px] text-gray-500 flex justify-between items-center">
        <span>Intellidon Verification Services</span>
        <span>Secure HTTPS Connection</span>
      </footer>
    </div>
  )
}
