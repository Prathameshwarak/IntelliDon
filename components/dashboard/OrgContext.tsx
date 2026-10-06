'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export type OrgAddressDetails = {
  room_no?: string
  floor_no?: string
  building_name?: string
  colony_name?: string
  street_name?: string
  area_name?: string
}

export type OrgOrganization = {
  id: string
  name: string
  phone: string | null
  org_email: string | null
  website: string | null
  address: string | null
  address_details: OrgAddressDetails
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  doc_logo: string | null
  status: string
  kyc_status: string
}

export type OrgAdministrator = {
  full_name: string
  email: string
  phone: string
  role: string
}

export type OrgKyc = {
  status: string
  notes: string | null
  documents: Record<string, string | null>
}

type OrgContextType = {
  loading: boolean
  userId: string | null
  userRole: string
  mandalId: string | null
  mandalName: string
  organization: OrgOrganization | null
  administrator: OrgAdministrator | null
  kyc: OrgKyc | null
  isAdmin: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
  toast: { msg: string; type: 'success' | 'error' } | null
  refresh: () => Promise<void>
  getAuthHeaders: () => Promise<Record<string, string>>
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('')
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')
  const [organization, setOrganization] = useState<OrgOrganization | null>(null)
  const [administrator, setAdministrator] = useState<OrgAdministrator | null>(null)
  const [kyc, setKyc] = useState<OrgKyc | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      const meData = await meRes.json()
      if (!meRes.ok || meData.error || !meData.user || !meData.profile) {
        router.push('/login')
        return
      }

      const role = meData.profile.role
      if (!['admin', 'manager'].includes(role)) {
        if (role === 'collector') router.push('/collect')
        else if (role === 'super_admin') router.push('/super-admin')
        else router.push('/login')
        return
      }

      setUserId(meData.user.id)
      setUserRole(role)
      setMandalId(meData.profile.mandal_id)
      setMandalName(meData.mandal?.name || '')

      const profRes = await fetch('/api/mandals/profile', { headers: { Authorization: `Bearer ${token}` } })
      const profData = await profRes.json()
      if (profRes.ok && profData.success) {
        setOrganization(profData.organization)
        setAdministrator(profData.administrator)
        setKyc(profData.kyc || null)
        if (profData.organization?.name) setMandalName(profData.organization.name)
      }
    } catch (e) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <OrgContext.Provider
      value={{
        loading, userId, userRole, mandalId, mandalName,
        organization, administrator, kyc, isAdmin: userRole === 'admin',
        showToast, toast, refresh: load, getAuthHeaders,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider')
  return ctx
}
