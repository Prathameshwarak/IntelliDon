'use client'

import { useState } from 'react'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

const DOC_FIELDS = [
  { key: 'doc_reg_cert', label: 'Registration Certificate' },
  { key: 'doc_admin_aadhaar', label: 'Admin Aadhaar' },
  { key: 'doc_admin_pan', label: 'Admin PAN' },
  { key: 'doc_org_pan', label: 'Organisation PAN' },
  { key: 'doc_bank_proof', label: 'Bank Proof (cheque/passbook)' },
  { key: 'doc_auth_letter', label: 'Auth Letter / Resolution' },
  { key: 'doc_address_proof', label: 'Address Proof' },
] as const

type DocStatus = 'approved' | 'rejected' | 'pending'

function parseDocumentStatuses(raw: string | null): Record<string, DocStatus> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed.documentStatuses || {}
  } catch {}
  return {}
}

function StatusBadge({ status, hasDoc }: { status: DocStatus | undefined; hasDoc: boolean }) {
  if (!hasDoc) {
    return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-[#1A1208]/5 dark:bg-gray-800 text-[#7a6a55] dark:text-gray-400 border-[#1A1208]/10 dark:border-gray-700">Not Uploaded</span>
  }
  if (status === 'approved') {
    return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20">Verified</span>
  }
  if (status === 'rejected') {
    return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">Rejected</span>
  }
  return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">Pending</span>
}

export default function OrganizationKycPage() {
  const { loading, mandalId, userId, isAdmin, kyc, showToast, refresh, getAuthHeaders } = useOrg()
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [viewingKey, setViewingKey] = useState<string | null>(null)

  const kycStatus = kyc?.status || 'pending'
  const documentStatuses = parseDocumentStatuses(kyc?.notes || null)
  const documents = kyc?.documents || {}

  async function handleUpload(key: string, file: File | null) {
    if (!file || !mandalId || !userId) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5MB', 'error')
      return
    }
    setUploadingKey(key)
    try {
      const fd = new FormData()
      fd.append('mandal_id', mandalId)
      fd.append('user_id', userId)
      fd.append(key, file)

      const headers = await getAuthHeaders()
      const res = await fetch('/api/mandals/kyc-resubmit', { method: 'POST', headers, body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

      showToast('Document uploaded — pending Super Admin review', 'success')
      await refresh()
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  async function handleView(key: string) {
    const path = documents[key]
    if (!path) {
      showToast('No document on file yet', 'error')
      return
    }
    setViewingKey(key)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ path, bucket: 'kyc-documents' }),
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.signedUrl) throw new Error(data.error || 'Could not open document')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      showToast(err.message || 'Could not open document', 'error')
    } finally {
      setViewingKey(null)
    }
  }

  return (
    <OrgShell title="Organization KYC" subtitle="Verification documents & review status">
      {loading ? (
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-mono animate-pulse">Loading KYC status...</p>
      ) : (
        <>
          <div className={`rounded-xl px-4 py-3 mb-4 text-xs font-semibold border
            ${kycStatus === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-green-400'
              : kycStatus === 'rejected'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'}`}>
            Overall KYC status: <span className="capitalize font-bold">{kycStatus.replace('_', ' ')}</span>
            {kycStatus !== 'approved' && ' — documents are reviewed by the Super Admin before being marked Verified.'}
          </div>

          <div className="flex flex-col gap-3">
            {DOC_FIELDS.map(doc => {
              const status = documentStatuses[doc.key]
              const path = documents[doc.key]
              const hasDoc = !!path

              return (
                <div key={doc.key} className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-[#1A1208] dark:text-white">{doc.label}</p>
                    <div className="mt-1"><StatusBadge status={status} hasDoc={hasDoc} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasDoc && (
                      <button
                        onClick={() => handleView(doc.key)}
                        disabled={viewingKey === doc.key}
                        className="text-xs font-bold text-[#1A1208] dark:text-white bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 border border-[#1A1208]/10 dark:border-gray-700 rounded-lg px-3 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {viewingKey === doc.key ? 'Opening...' : 'View'}
                      </button>
                    )}
                    {isAdmin && status !== 'approved' && (
                      <label className="text-xs font-bold text-[#E8650A] dark:text-orange-400 border border-[#E8650A]/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#E8650A]/5 transition-colors">
                        {uploadingKey === doc.key ? 'Uploading...' : hasDoc ? 'Re-upload' : 'Upload'}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, application/pdf"
                          className="hidden"
                          disabled={uploadingKey === doc.key}
                          onChange={e => handleUpload(doc.key, e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {!isAdmin && (
            <p className="mt-4 text-xs text-[#7a6a55] dark:text-gray-500 font-medium">
              Only the Adhyaksha (Admin) can upload or re-upload KYC documents.
            </p>
          )}
        </>
      )}
    </OrgShell>
  )
}
