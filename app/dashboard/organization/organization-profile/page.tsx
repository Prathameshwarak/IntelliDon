'use client'

import { useEffect, useState } from 'react'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

type FormState = {
  name: string
  phone: string
  org_email: string
  website: string
  room_no: string
  floor_no: string
  building_name: string
  colony_name: string
  street_name: string
  area_name: string
  country: string
  state: string
  city: string
  pincode: string
}

const EMPTY: FormState = {
  name: '', phone: '', org_email: '', website: '',
  room_no: '', floor_no: '', building_name: '', colony_name: '', street_name: '', area_name: '',
  country: 'India', state: 'Maharashtra', city: '', pincode: '',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}

const inputClass = "w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A] disabled:opacity-60 disabled:cursor-not-allowed"

export default function OrganizationProfilePage() {
  const { loading, organization, isAdmin, showToast, refresh, getAuthHeaders } = useOrg()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoSignedUrl, setLogoSignedUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  function hydrateFromOrg() {
    if (!organization) return
    const d = organization.address_details || {}
    setForm({
      name: organization.name || '',
      phone: organization.phone || '',
      org_email: organization.org_email || '',
      website: organization.website || '',
      room_no: d.room_no || '',
      floor_no: d.floor_no || '',
      building_name: d.building_name || '',
      colony_name: d.colony_name || '',
      street_name: d.street_name || '',
      area_name: d.area_name || '',
      country: organization.country || 'India',
      state: organization.state || 'Maharashtra',
      city: organization.city || '',
      pincode: organization.pincode || '',
    })
  }

  useEffect(() => { hydrateFromOrg() }, [organization])

  useEffect(() => {
    async function fetchLogo() {
      if (!organization?.doc_logo) { setLogoSignedUrl(null); return }
      try {
        const headers = await getAuthHeaders()
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ path: organization.doc_logo, bucket: 'kyc-documents' }),
        })
        const data = await res.json()
        if (data.success) setLogoSignedUrl(data.signedUrl)
      } catch {}
    }
    fetchLogo()
  }, [organization?.doc_logo])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleCancel() {
    hydrateFromOrg()
    setLogoFile(null)
    setLogoPreview(null)
    setEditing(false)
  }

  function handleLogoChange(file: File | null) {
    setLogoFile(file)
    if (file) setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Organization name is required', 'error'); return }
    if (!form.phone.trim()) { showToast('Contact number is required', 'error'); return }
    if (!form.city.trim() || !form.state.trim() || !form.country.trim() || !form.pincode.trim()) {
      showToast('Country, State, City and Pincode are required', 'error'); return
    }

    setSaving(true)
    try {
      const headers = await getAuthHeaders()

      // Upload logo first if a new one was selected
      if (logoFile) {
        setUploadingLogo(true)
        const fd = new FormData()
        fd.append('file', logoFile)
        fd.append('documentKey', 'doc_logo')
        if (organization?.id) fd.append('mandalId', organization.id)
        fd.append('bucket', 'kyc-documents')
        const upRes = await fetch('/api/storage/upload', { method: 'POST', body: fd })
        const upData = await upRes.json()
        if (!upRes.ok || upData.error) throw new Error(upData.error || 'Logo upload failed')
        setUploadingLogo(false)
      }

      const res = await fetch('/api/mandals/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          section: 'organization',
          name: form.name,
          phone: form.phone,
          org_email: form.org_email,
          website: form.website,
          country: form.country,
          state: form.state,
          city: form.city,
          pincode: form.pincode,
          address_details: {
            room_no: form.room_no,
            floor_no: form.floor_no,
            building_name: form.building_name,
            colony_name: form.colony_name,
            street_name: form.street_name,
            area_name: form.area_name,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Could not save profile')

      showToast('Organization profile updated', 'success')
      setEditing(false)
      setLogoFile(null)
      setLogoPreview(null)
      await refresh()
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setSaving(false)
      setUploadingLogo(false)
    }
  }

  return (
    <OrgShell title="Organization Profile" subtitle="Core identity and contact details for your organization">
      {loading ? null : (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview || logoSignedUrl ? (
                  <img src={logoPreview || logoSignedUrl || ''} alt="Organization logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-[#7a6a55] dark:text-gray-500">{(form.name || 'O').charAt(0).toUpperCase()}</span>
                )}
              </div>
              {editing && isAdmin && (
                <label className="text-xs font-bold text-[#E8650A] dark:text-orange-400 border border-[#E8650A]/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#E8650A]/5 transition-colors">
                  Change Logo
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    className="hidden"
                    onChange={e => handleLogoChange(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>

            {isAdmin && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-bold bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-700 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Organization / Mandal Name" required>
              <input className={inputClass} disabled={!editing} value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label="Contact Number" required>
              <input className={inputClass} disabled={!editing} value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} />
            </Field>
            <Field label="Organization Email">
              <input type="email" className={inputClass} disabled={!editing} value={form.org_email} onChange={e => set('org_email', e.target.value)} placeholder="contact@organization.org" />
            </Field>
            <Field label="Website (optional)">
              <input className={inputClass} disabled={!editing} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" />
            </Field>
          </div>

          <div className="mt-6 pt-5 border-t border-[#1A1208]/10 dark:border-gray-800">
            <p className="text-xs font-bold text-[#1A1208] dark:text-white mb-3">Office Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Room No."><input className={inputClass} disabled={!editing} value={form.room_no} onChange={e => set('room_no', e.target.value)} /></Field>
              <Field label="Floor No."><input className={inputClass} disabled={!editing} value={form.floor_no} onChange={e => set('floor_no', e.target.value)} /></Field>
              <Field label="Building Name"><input className={inputClass} disabled={!editing} value={form.building_name} onChange={e => set('building_name', e.target.value)} /></Field>
              <Field label="Colony Name"><input className={inputClass} disabled={!editing} value={form.colony_name} onChange={e => set('colony_name', e.target.value)} /></Field>
              <Field label="Street Name"><input className={inputClass} disabled={!editing} value={form.street_name} onChange={e => set('street_name', e.target.value)} /></Field>
              <Field label="Area Name"><input className={inputClass} disabled={!editing} value={form.area_name} onChange={e => set('area_name', e.target.value)} /></Field>
              <Field label="Country" required><input className={inputClass} disabled={!editing} value={form.country} onChange={e => set('country', e.target.value)} /></Field>
              <Field label="State" required><input className={inputClass} disabled={!editing} value={form.state} onChange={e => set('state', e.target.value)} /></Field>
              <Field label="City / Town" required><input className={inputClass} disabled={!editing} value={form.city} onChange={e => set('city', e.target.value)} /></Field>
              <Field label="Pincode" required><input className={inputClass} disabled={!editing} value={form.pincode} onChange={e => set('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} /></Field>
            </div>
          </div>

          {editing && (
            <div className="flex gap-2 justify-end mt-6 pt-5 border-t border-[#1A1208]/10 dark:border-gray-800">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2.5 bg-[#ebdcc9] dark:bg-gray-800 hover:bg-[#dfcdb7] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
              >
                {saving ? (uploadingLogo ? 'Uploading logo...' : 'Saving...') : 'Save Changes'}
              </button>
            </div>
          )}

          {!isAdmin && (
            <p className="mt-5 text-xs text-[#7a6a55] dark:text-gray-500 font-medium">
              Only the Adhyaksha (Admin) can edit the organization profile.
            </p>
          )}
        </div>
      )}
    </OrgShell>
  )
}
