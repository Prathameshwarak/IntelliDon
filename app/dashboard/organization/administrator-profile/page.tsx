'use client'

import { useEffect, useState } from 'react'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

const inputClass = "w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A] disabled:opacity-60 disabled:cursor-not-allowed"

export default function AdministratorProfilePage() {
  const { loading, administrator, isAdmin, showToast, refresh, getAuthHeaders } = useOrg()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  function hydrate() {
    setFullName(administrator?.full_name || '')
    setEmail(administrator?.email || '')
    setPhone(administrator?.phone || '')
  }

  useEffect(() => { hydrate() }, [administrator])

  async function handleSave() {
    if (!fullName.trim()) { showToast('Full name is required', 'error'); return }
    if (phone.trim().length !== 10) { showToast('Enter a valid 10-digit phone number', 'error'); return }

    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/mandals/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ section: 'administrator', full_name: fullName.trim(), email: email.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Could not save')
      showToast('Administrator profile updated', 'success')
      setEditing(false)
      await refresh()
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OrgShell title="Administrator Profile" subtitle="Your personal details as the organization's Adhyaksha">
      {loading ? null : (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm max-w-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E8650A]/10 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold text-[#E8650A] dark:text-orange-400">
                {(fullName || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1208] dark:text-white">{fullName || 'Administrator'}</p>
                <p className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-500 tracking-wider">{administrator?.role === 'admin' ? 'Adhyaksha' : 'Khajindar'}</p>
              </div>
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

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Full Name *</label>
              <input className={inputClass} disabled={!editing} value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Email</label>
              <input type="email" className={inputClass} disabled={!editing} value={email} onChange={e => setEmail(e.target.value)} />
              {editing && (
                <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-medium mt-1">
                  This is your contact email. It does not change your login credentials.
                </p>
              )}
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Phone Number *</label>
              <input
                type="tel"
                className={inputClass}
                disabled={!editing}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                maxLength={10}
              />
            </div>
          </div>

          {editing && (
            <div className="flex gap-2 justify-end mt-6 pt-5 border-t border-[#1A1208]/10 dark:border-gray-800">
              <button
                onClick={() => { hydrate(); setEditing(false) }}
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
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {!isAdmin && (
            <p className="mt-5 text-xs text-[#7a6a55] dark:text-gray-500 font-medium">
              Only the Adhyaksha (Admin) can edit their own administrator profile.
            </p>
          )}
        </div>
      )}
    </OrgShell>
  )
}
