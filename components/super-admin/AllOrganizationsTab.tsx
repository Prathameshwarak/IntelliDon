'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  full_name: string | null
  phone: string | null
  email?: string | null
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

  // Change Password Modal OTP States
  const [resetPasswordStep, setResetPasswordStep] = useState<1 | 2 | 3>(1)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('')
  const [resetOtpCode, setResetOtpCode] = useState(['', '', '', '', '', ''])
  const [resetOtpLoading, setResetOtpLoading] = useState(false)
  const [resetOtpError, setResetOtpError] = useState('')
  const [resetOtpSuccessMsg, setResetOtpSuccessMsg] = useState('')
  const [resetCooldownTimer, setResetCooldownTimer] = useState(0)
  const [resetOtpVerified, setResetOtpVerified] = useState(false)

  // Create organization modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mandalName, setMandalName] = useState('')
  const [mandalAddress, setMandalAddress] = useState('')
  const [mandalCity, setMandalCity] = useState('')
  const [mandalState, setMandalState] = useState('Maharashtra')
  const [mandalPincode, setMandalPincode] = useState('')
  const [mandalPhone, setMandalPhone] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [mandalUpiId, setMandalUpiId] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('Welcome@123')
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('Welcome@123')
  const [autoApprove, setAutoApprove] = useState(true)

  // Phone error states
  const [mandalPhoneError, setMandalPhoneError] = useState('')
  const [adminPhoneError, setAdminPhoneError] = useState('')

  // OTP State for Organization Email
  const [orgOtpSent, setOrgOtpSent] = useState(false)
  const [orgOtpCode, setOrgOtpCode] = useState('')
  const [orgEmailVerified, setOrgEmailVerified] = useState(false)
  const [orgOtpLoading, setOrgOtpLoading] = useState(false)
  const [orgOtpTimer, setOrgOtpTimer] = useState(0)
  const [orgCooldownTimer, setOrgCooldownTimer] = useState(0)
  const [orgOtpError, setOrgOtpError] = useState('')
  const [orgOtpSuccessMsg, setOrgOtpSuccessMsg] = useState('')

  // OTP State for Admin Email
  const [adminOtpSent, setAdminOtpSent] = useState(false)
  const [adminOtpCode, setAdminOtpCode] = useState('')
  const [adminEmailVerified, setAdminEmailVerified] = useState(false)
  const [adminOtpLoading, setAdminOtpLoading] = useState(false)
  const [adminOtpTimer, setAdminOtpTimer] = useState(0)
  const [adminCooldownTimer, setAdminCooldownTimer] = useState(0)
  const [adminOtpError, setAdminOtpError] = useState('')
  const [adminOtpSuccessMsg, setAdminOtpSuccessMsg] = useState('')
  const [allowAdminEmailEdit, setAllowAdminEmailEdit] = useState(false)

  // Timers for OTP Expiration & Cooldowns
  useEffect(() => {
    if (orgOtpTimer > 0) {
      const timer = setInterval(() => setOrgOtpTimer((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [orgOtpTimer])

  useEffect(() => {
    if (adminOtpTimer > 0) {
      const timer = setInterval(() => setAdminOtpTimer((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [adminOtpTimer])

  useEffect(() => {
    if (orgCooldownTimer > 0) {
      const timer = setInterval(() => setOrgCooldownTimer((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [orgCooldownTimer])

  useEffect(() => {
    if (adminCooldownTimer > 0) {
      const timer = setInterval(() => setAdminCooldownTimer((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [adminCooldownTimer])

  useEffect(() => {
    if (resetCooldownTimer > 0) {
      const timer = setInterval(() => setResetCooldownTimer((t) => t - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [resetCooldownTimer])

  // Auto-verify Admin Email if it matches Organization Email and Org Email is verified
  useEffect(() => {
    if (allowAdminEmailEdit) return
    const org = orgEmail.trim().toLowerCase()
    const admin = adminEmail.trim().toLowerCase()
    if (org && admin && org === admin && orgEmailVerified) {
      if (!adminEmailVerified) {
        setAdminEmailVerified(true)
        setAdminOtpError('')
        setAdminOtpSuccessMsg('Same email address as Organization Email (Verified)')
      }
    }
  }, [orgEmail, adminEmail, orgEmailVerified, adminEmailVerified, allowAdminEmailEdit])

  const checkPhoneExists = async (phone: string): Promise<boolean> => {
    const clean = phone.replace(/[^0-9]/g, '')
    if (clean.length !== 10) return false
    try {
      const res = await fetch('/api/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      })
      const data = await res.json()
      return data.exists === true
    } catch (e) {
      return false
    }
  }

  const handleSendOtp = async (target: 'org' | 'admin') => {
    const isOrg = target === 'org'
    const email = isOrg ? orgEmail : adminEmail
    const setLoading = isOrg ? setOrgOtpLoading : setAdminOtpLoading
    const setError = isOrg ? setOrgOtpError : setAdminOtpError
    const setSuccess = isOrg ? setOrgOtpSuccessMsg : setAdminOtpSuccessMsg
    const setSent = isOrg ? setOrgOtpSent : setAdminOtpSent
    const setTimer = isOrg ? setOrgOtpTimer : setAdminOtpTimer
    const setCooldown = isOrg ? setOrgCooldownTimer : setAdminCooldownTimer

    setError('')
    setSuccess('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email.trim())) {
      setError('Please enter a valid email address first.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (data.remainingSec) {
          setCooldown(data.remainingSec)
        }
        setError(data.error || 'Failed to send OTP.')
        return
      }
      setSent(true)
      setTimer(300)
      setCooldown(120)
      setSuccess('Verification code sent to your email!')
    } catch (err: any) {
      setError(err.message || 'Could not send OTP code.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (target: 'org' | 'admin') => {
    const isOrg = target === 'org'
    const email = isOrg ? orgEmail : adminEmail
    const code = isOrg ? orgOtpCode : adminOtpCode
    const setLoading = isOrg ? setOrgOtpLoading : setAdminOtpLoading
    const setError = isOrg ? setOrgOtpError : setAdminOtpError
    const setSuccess = isOrg ? setOrgOtpSuccessMsg : setAdminOtpSuccessMsg
    const setVerified = isOrg ? setOrgEmailVerified : setAdminEmailVerified

    setError('')
    setSuccess('')

    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid OTP code.')
      }
      setVerified(true)
      setSuccess('Email address verified successfully!')
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.')
    } finally {
      setLoading(false)
    }
  }

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
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, bucket: 'kyc-documents' })
      })
      const data = await res.json()
        
      if (!res.ok || !data?.signedUrl) throw new Error(data?.error || 'Could not sign file URL')
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
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, bucket: 'kyc-documents' })
      })
      const data = await res.json()
        
      if (!res.ok || !data?.signedUrl) throw new Error(data?.error || 'Could not sign file URL')
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentKey', uploadingDocKey)
      formData.append('mandalId', viewingOrg.id)
      formData.append('bucket', 'kyc-documents')

      const uploadRes = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || uploadData.error) throw new Error(uploadData.error || 'Upload error')

      const path = uploadData.path

      // 2. Update DB via PATCH api
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/super-admin/mandals', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ mandalId: viewingOrg.id, documentKey: uploadingDocKey, documentPath: path })
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

  function openChangePasswordModal(userId: string, emailFromContext?: string | null) {
    const adminUser = viewingOrg?.users?.find(u => u.role === 'admin' || u.id === userId)
    const targetEmail = emailFromContext || adminUser?.email || viewingOrg?.admin_email || detailedUser?.email || ''
    setResetPasswordUserId(userId || adminUser?.id || 'admin')
    setResetPasswordEmail(targetEmail)
    setResetPasswordStep(1)
    setNewPasswordValue('')
    setResetOtpCode(['', '', '', '', '', ''])
    setResetOtpError('')
    setResetOtpSuccessMsg('')
    setResetOtpVerified(false)
  }

  const handleSendChangePasswordOtp = async () => {
    setResetOtpError('')
    setResetOtpSuccessMsg('')

    if (!resetPasswordEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetPasswordEmail.trim())) {
      setResetOtpError('Valid admin email address is required to send OTP.')
      return
    }

    setResetOtpLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetPasswordEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (data.remainingSec) {
          setResetCooldownTimer(data.remainingSec)
        }
        setResetOtpError(data.error || 'Failed to send OTP code.')
        return
      }
      setResetPasswordStep(2)
      setResetCooldownTimer(120)
      setResetOtpSuccessMsg(`OTP code sent to ${resetPasswordEmail.trim()}`)
    } catch (err: any) {
      setResetOtpError(err.message || 'Could not send OTP code.')
    } finally {
      setResetOtpLoading(false)
    }
  }

  const handleVerifyChangePasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetOtpError('')
    setResetOtpSuccessMsg('')

    const code = resetOtpCode.join('').trim()
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setResetOtpError('Please enter the 6-digit verification code.')
      return
    }

    setResetOtpLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetPasswordEmail.trim(),
          otp: code,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid OTP code.')
      }

      setResetOtpVerified(true)
      setResetPasswordStep(3)
      setResetOtpSuccessMsg('OTP verified successfully! Please enter new password.')
    } catch (err: any) {
      setResetOtpError(err.message || 'OTP verification failed.')
    } finally {
      setResetOtpLoading(false)
    }
  }

  const handleResetOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...resetOtpCode]
    newOtp[index] = value.slice(-1)
    setResetOtpCode(newOtp)

    if (value && index < 5) {
      const nextInput = document.getElementById(`change-pass-otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleResetOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !resetOtpCode[index] && index > 0) {
      const prevInput = document.getElementById(`change-pass-otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleResetOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedData)) {
      setResetOtpCode(pastedData.split(''))
      const lastInput = document.getElementById(`change-pass-otp-5`)
      lastInput?.focus()
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetPasswordUserId || newPasswordValue.length < 8) return

    if (!resetOtpVerified) {
      setResetOtpError('OTP verification is required before updating password.')
      return
    }

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
        body: JSON.stringify({ password: newPasswordValue, email: resetPasswordEmail.trim() })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast('Password updated successfully!', 'success')
      setResetPasswordUserId(null)
      setNewPasswordValue('')
      setResetPasswordStep(1)
      setResetOtpVerified(false)

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
    if (!mandalPhone.trim() || mandalPhone.replace(/[^0-9]/g, '').length !== 10) {
      showToast('Mandal contact phone must be a 10-digit number', 'error'); return
    }
    if (!orgEmail.trim() || !orgEmailVerified) {
      showToast('Organization email must be verified via OTP before creating', 'error'); return
    }
    if (!mandalAddress.trim()) { showToast('Address is required', 'error'); return }
    if (!mandalCity.trim()) { showToast('City is required', 'error'); return }
    if (!mandalPincode.trim() || mandalPincode.length < 6) { showToast('Please enter a valid 6-digit pincode', 'error'); return }
    if (!adminName.trim()) { showToast('Admin full name is required', 'error'); return }
    if (!adminEmail.trim() || !adminEmailVerified) {
      showToast('Admin email must be verified via OTP before creating', 'error'); return
    }
    if (!adminPhone.trim() || adminPhone.replace(/[^0-9]/g, '').length !== 10) {
      showToast('Admin mobile number must be a 10-digit number', 'error'); return
    }
    if (!adminPassword.trim() || adminPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    if (adminPassword !== adminConfirmPassword) { showToast('Admin passwords do not match', 'error'); return }

    setCreating(true)
    try {
      // Check phone duplicates before creating
      const mandalPhoneTaken = await checkPhoneExists(mandalPhone)
      if (mandalPhoneTaken) {
        setMandalPhoneError('This phone number is already registered.')
        showToast('Mandal phone number is already registered with another organization.', 'error')
        setCreating(false)
        return
      }

      const adminPhoneTaken = await checkPhoneExists(adminPhone)
      if (adminPhoneTaken) {
        setAdminPhoneError('This phone number is already registered.')
        showToast('Admin phone number is already registered with another organization.', 'error')
        setCreating(false)
        return
      }

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
          state: mandalState.trim(),
          pincode: mandalPincode.trim(),
          phone: mandalPhone.trim(),
          orgEmail: orgEmail.trim(),
          upiId: mandalUpiId.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          adminPhone: adminPhone.trim(),
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
      setMandalState('Maharashtra')
      setMandalPincode('')
      setMandalPhone('')
      setOrgEmail('')
      setOrgEmailVerified(false)
      setOrgOtpSent(false)
      setMandalUpiId('')
      setAdminName('')
      setAdminEmail('')
      setAdminEmailVerified(false)
      setAdminOtpSent(false)
      setAdminPhone('')
      setAdminPassword('Welcome@123')
      setAdminConfirmPassword('Welcome@123')
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
        <h2 className="text-xl font-extrabold text-[#1A1208] dark:text-white">All Registered Organizations</h2>
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1">List of all communities registered on Intellidon sorted alphabetically by name.</p>
      </div>

      {/* Grid Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-bold uppercase tracking-wider">Total Orgs</p>
          <p className="text-xl font-black text-[#1A1208] dark:text-white">{totalCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider">Active Orgs</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-450">{activeCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-[#E8650A] dark:text-amber-500 font-bold uppercase tracking-wider">Pending KYC</p>
          <p className="text-xl font-black text-[#E8650A] dark:text-amber-450">{pendingCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-rose-600 dark:text-rose-500 font-bold uppercase tracking-wider">Rejected</p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-455">{rejectedCount}</p>
        </div>
        <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-bold uppercase tracking-wider">Suspended</p>
          <p className="text-xl font-black text-[#7a6a55] dark:text-gray-400">{suspendedCount}</p>
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
            className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A] rounded-xl px-4 py-2.5 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-[10px] text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] font-bold rounded-xl text-xs text-white cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#E8650A]/20"
          >
            ➕ Add Organization
          </button>
          <button 
            onClick={fetchAllOrganizations}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#F5EDE2] dark:bg-gray-900 hover:bg-[#ebdcc9] dark:hover:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-800 font-bold rounded-xl text-xs text-[#1A1208] dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* Main List Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-mono animate-pulse">Loading records...</p>
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <p className="text-xs text-[#7a6a55] dark:text-gray-550">No organizations found matching your search criteria.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div 
            className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
            onScroll={handleScroll}
          >
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-[#F5EDE2] dark:bg-gray-900 z-10 border-b border-[#1A1208]/10 dark:border-gray-800">
                <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 text-[10px] text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-5">Organization Name</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Contacts</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-center">KYC Status</th>
                  <th className="py-3.5 px-5">Subscription</th>
                  <th className="py-3.5 px-5">Created At</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1208]/10 dark:divide-gray-800 text-xs">
                {filteredOrgs.slice(0, visibleCount).map(org => {
                  const sub = org.subscriptions?.[0]
                  return (
                    <tr key={org.id} className="hover:bg-[#F5EDE2]/50 dark:hover:bg-gray-800/30 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-5 font-bold text-[#1A1208] dark:text-white">
                        {org.name}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-5 text-[#1A1208] dark:text-gray-300 font-bold">
                        {org.city || '—'}
                        {org.pincode && <span className="text-[10px] text-[#7a6a55] dark:text-gray-500 block font-normal">{org.pincode}</span>}
                      </td>

                      {/* Contacts */}
                      <td className="py-3.5 px-5 text-[#1A1208] dark:text-gray-300 space-y-0.5 font-medium">
                        <div className="text-[11px] font-bold">{org.phone || '—'}</div>
                        <div className="text-[10px] text-[#7a6a55] dark:text-gray-400">Admin: {org.admin_full_name || '—'}</div>
                      </td>

                      {/* Mandal Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border
                          ${org.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : org.status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20'
                            : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400 border-amber-500/20'}`}>
                          {org.status}
                        </span>
                      </td>

                      {/* KYC Status */}
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border
                          ${org.kyc_status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : org.kyc_status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20'
                            : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400 border-amber-500/20'}`}>
                          {org.kyc_status || 'pending'}
                        </span>
                      </td>

                      {/* Active Subscription */}
                      <td className="py-3.5 px-5">
                        {sub ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#1A1208] dark:text-gray-200 capitalize">{sub.plan} Plan</span>
                            {sub.ends_at && (
                              <span className="text-[9px] text-[#7a6a55] dark:text-gray-500 block font-medium">Expires {formatDate(sub.ends_at)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#7a6a55] dark:text-gray-500 italic">No active plan</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-5 text-[#1A1208] dark:text-gray-400 font-bold">
                        {formatDate(org.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setViewingOrg(org)}
                          className="px-3.5 py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 font-bold rounded-xl text-[10px] transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
            {/* Header */}
            <div className="p-6 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1208] dark:text-white">Create New Organization</h3>
                <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">Fill in details to instantly register and configure a new mandal profile.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white text-xs p-1 font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrganization} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Section 1: Mandal Profile Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">1. Organization Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Organization Name *</label>
                    <input 
                      type="text" 
                      value={mandalName} 
                      onChange={e => setMandalName(e.target.value)}
                      required
                      placeholder="e.g. Shree Ganesh Mitra Mandal"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>
                  
                  {/* Mandal Phone */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Mandal Contact Phone *</label>
                    <input 
                      type="tel" 
                      value={mandalPhone} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        setMandalPhone(val);
                        if (val.length === 10) setMandalPhoneError('');
                      }}
                      onBlur={async (e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length === 10) {
                          const taken = await checkPhoneExists(val);
                          if (taken) setMandalPhoneError('This phone number is already registered.');
                          else setMandalPhoneError('');
                        }
                      }}
                      maxLength={10}
                      required
                      placeholder="10-digit number"
                      className={`w-full bg-white dark:bg-gray-950 border rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none font-medium ${
                        mandalPhoneError ? 'border-rose-500' : 'border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A]'
                      }`}
                    />
                    {mandalPhoneError && (
                      <p className="text-[10px] text-rose-500 mt-1 font-semibold">{mandalPhoneError}</p>
                    )}
                  </div>

                  {/* Organization Email with OTP verification */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Organization Email *</label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input 
                        type="email" 
                        value={orgEmail} 
                        onChange={e => {
                          setOrgEmail(e.target.value);
                          if (orgEmailVerified) {
                            setOrgEmailVerified(false);
                            setOrgOtpSent(false);
                          }
                        }}
                        required
                        placeholder="contact@mandalname.org"
                        className={`w-full flex-1 min-w-0 bg-white dark:bg-gray-950 border rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none font-medium ${
                          orgEmailVerified ? 'border-emerald-500 text-emerald-600 font-bold' : orgOtpError ? 'border-rose-500' : 'border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A]'
                        }`}
                      />

                      {orgEmailVerified ? (
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold whitespace-nowrap">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendOtp('org')}
                          disabled={orgOtpLoading || !orgEmail.trim() || orgCooldownTimer > 0}
                          className="w-full sm:w-auto px-3 py-2 bg-[#E8650A] hover:bg-[#d05807] disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                        >
                          {orgOtpLoading ? 'Sending...' : orgCooldownTimer > 0 ? `Resend (${orgCooldownTimer}s)` : orgOtpSent ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      )}
                    </div>

                    {orgOtpError && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{orgOtpError}</p>}
                    {orgOtpSuccessMsg && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">{orgOtpSuccessMsg}</p>}

                    {/* Organization Email OTP Verification Card */}
                    {orgOtpSent && !orgEmailVerified && (
                      <div className="mt-2 p-3 bg-[#F5EDE2] dark:bg-gray-950 border border-[#E8650A]/30 rounded-xl space-y-2">
                        <div className="flex flex-col xs:flex-row xs:items-center justify-between text-[10px] gap-1">
                          <span className="font-semibold text-[#1A1208] dark:text-gray-300">Enter 6-Digit OTP</span>
                          <span className="font-mono text-[#E8650A] font-bold">
                            Expires in {Math.floor(orgOtpTimer / 60)}:{(orgOtpTimer % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex flex-col xs:flex-row sm:flex-row gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={orgOtpCode}
                            onChange={(e) => setOrgOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="6-digit code"
                            className="w-full flex-1 min-w-0 px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-center bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#E8650A]"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyOtp('org')}
                            disabled={orgOtpLoading || orgOtpCode.length !== 6}
                            className="w-full xs:w-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
                          >
                            {orgOtpLoading ? 'Verifying...' : 'Verify OTP'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Office Address *</label>
                    <input 
                      type="text" 
                      value={mandalAddress} 
                      onChange={e => setMandalAddress(e.target.value)}
                      required
                      placeholder="Street, area details"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">City *</label>
                    <input 
                      type="text" 
                      value={mandalCity} 
                      onChange={e => setMandalCity(e.target.value)}
                      required
                      placeholder="e.g. Mumbai"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">State *</label>
                    <select
                      value={mandalState}
                      onChange={e => setMandalState(e.target.value)}
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white focus:outline-none focus:border-[#E8650A] font-medium"
                    >
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                      <option value="West Bengal">West Bengal</option>
                      <option value="Goa">Goa</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Pincode *</label>
                    <input 
                      type="text" 
                      value={mandalPincode} 
                      onChange={e => setMandalPincode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      placeholder="6-digit pincode"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>

                  {/* UPI ID */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">UPI ID (optional)</label>
                    <input 
                      type="text" 
                      value={mandalUpiId} 
                      onChange={e => setMandalUpiId(e.target.value)}
                      placeholder="e.g. mandal@upi"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Administrator Credentials */}
              <div className="space-y-4 border-t border-[#1A1208]/10 dark:border-gray-800 pt-5">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">2. Admin User Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Admin Name */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Admin Full Name *</label>
                    <input 
                      type="text" 
                      value={adminName} 
                      onChange={e => setAdminName(e.target.value)}
                      required
                      placeholder="Full Name"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                    />
                  </div>

                  {/* Admin Phone */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Admin Mobile Number *</label>
                    <input 
                      type="tel" 
                      value={adminPhone} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        setAdminPhone(val);
                        if (val.length === 10) setAdminPhoneError('');
                      }}
                      onBlur={async (e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length === 10) {
                          const taken = await checkPhoneExists(val);
                          if (taken) setAdminPhoneError('This phone number is already registered.');
                          else setAdminPhoneError('');
                        }
                      }}
                      maxLength={10}
                      required
                      placeholder="10-digit number"
                      className={`w-full bg-white dark:bg-gray-950 border rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none font-medium ${
                        adminPhoneError ? 'border-rose-500' : 'border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A]'
                      }`}
                    />
                    {adminPhoneError && (
                      <p className="text-[10px] text-rose-500 mt-1 font-semibold">{adminPhoneError}</p>
                    )}
                  </div>

                  {/* Admin Email */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Admin Email Address *</label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input 
                        type="email" 
                        value={adminEmail} 
                        onChange={e => {
                          const val = e.target.value;
                          setAdminEmail(val);
                          if (allowAdminEmailEdit) setAllowAdminEmailEdit(false);
                          if (adminEmailVerified) {
                            const org = orgEmail.trim().toLowerCase();
                            if (!org || org !== val.trim().toLowerCase() || !orgEmailVerified) {
                              setAdminEmailVerified(false);
                              setAdminOtpSent(false);
                            }
                          }
                        }}
                        readOnly={adminEmailVerified}
                        required
                        placeholder="admin@email.com"
                        className={`w-full flex-1 min-w-0 bg-white dark:bg-gray-950 border rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none font-medium ${
                          adminEmailVerified ? 'border-emerald-500 text-emerald-600 font-bold' : adminOtpError ? 'border-rose-500' : 'border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A]'
                        }`}
                      />

                      {adminEmailVerified ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Verified
                          </span>
                          {orgEmail.trim() && adminEmail.trim().toLowerCase() === orgEmail.trim().toLowerCase() && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminEmailVerified(false);
                                setAdminOtpSent(false);
                                setAdminOtpSuccessMsg("");
                                setAllowAdminEmailEdit(true);
                                setAdminEmail("");
                              }}
                              title="Change Admin Email"
                              aria-label="Change Admin Email"
                              className="p-1.5 rounded-lg bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-slate-400 hover:text-[#E8650A] hover:bg-[#E8650A]/10 border border-[#1A1208]/10 dark:border-slate-700 transition-all duration-200 cursor-pointer flex items-center justify-center"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendOtp('admin')}
                          disabled={adminOtpLoading || !adminEmail.trim() || adminCooldownTimer > 0}
                          className="w-full sm:w-auto px-3 py-2 bg-[#E8650A] hover:bg-[#d05807] disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                        >
                          {adminOtpLoading ? 'Sending...' : adminCooldownTimer > 0 ? `Resend (${adminCooldownTimer}s)` : adminOtpSent ? 'Resend OTP' : 'Send OTP'}
                        </button>
                      )}
                    </div>

                    {adminOtpError && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{adminOtpError}</p>}
                    {adminOtpSuccessMsg && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">{adminOtpSuccessMsg}</p>}

                    {/* Admin Email OTP Verification Card */}
                    {adminOtpSent && !adminEmailVerified && (
                      <div className="mt-2 p-3 bg-[#F5EDE2] dark:bg-gray-950 border border-[#E8650A]/30 rounded-xl space-y-2">
                        <div className="flex flex-col xs:flex-row xs:items-center justify-between text-[10px] gap-1">
                          <span className="font-semibold text-[#1A1208] dark:text-gray-300">Enter 6-Digit OTP</span>
                          <span className="font-mono text-[#E8650A] font-bold">
                            Expires in {Math.floor(adminOtpTimer / 60)}:{(adminOtpTimer % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex flex-col xs:flex-row sm:flex-row gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={adminOtpCode}
                            onChange={(e) => setAdminOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="6-digit code"
                            className="w-full flex-1 min-w-0 px-3 py-1.5 text-xs font-mono font-bold tracking-widest text-center bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#E8650A]"
                          />
                          <button
                            type="button"
                            onClick={() => handleVerifyOtp('admin')}
                            disabled={adminOtpLoading || adminOtpCode.length !== 6}
                            className="w-full xs:w-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
                          >
                            {adminOtpLoading ? 'Verifying...' : 'Verify OTP'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Admin Password *</label>
                    <input 
                      type="password" 
                      value={adminPassword} 
                      onChange={e => setAdminPassword(e.target.value)}
                      required
                      placeholder="Min 8 characters"
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-mono font-medium"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1">Confirm Admin Password *</label>
                    <input 
                      type="password" 
                      value={adminConfirmPassword} 
                      onChange={e => setAdminConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm password"
                      className={`w-full bg-white dark:bg-gray-950 border rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none font-mono font-medium ${
                        adminConfirmPassword && adminPassword !== adminConfirmPassword ? 'border-rose-500' : 'border-[#1A1208]/15 dark:border-gray-800 focus:border-[#E8650A]'
                      }`}
                    />
                    {adminConfirmPassword && adminPassword !== adminConfirmPassword && (
                      <p className="text-[10px] text-rose-500 mt-1 font-semibold">Passwords do not match.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Activation Preferences */}
              <div className="space-y-3 border-t border-[#1A1208]/10 dark:border-gray-800 pt-5">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">3. Activation Settings</h4>
                <label className="flex items-start gap-3 bg-[#F5EDE2]/60 dark:bg-gray-950/60 p-4 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl cursor-pointer hover:bg-[#F5EDE2] dark:hover:bg-gray-950/80 transition-colors">
                  <input 
                    type="checkbox"
                    checked={autoApprove}
                    onChange={e => setAutoApprove(e.target.checked)}
                    className="mt-1 cursor-pointer accent-[#E8650A]"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#1A1208] dark:text-white">Auto-Approve KYC & Activate immediately</p>
                    <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">
                      Bypasses document uploads and activates the account with a 30-day trial subscription immediately.
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-[#1A1208]/10 dark:border-gray-800 pt-5 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !orgEmailVerified || !adminEmailVerified}
                  className="px-5 py-2 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-[#E8650A]/20 flex items-center gap-1.5"
                >
                  {creating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingOrg && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
            {/* Header */}
            <div className="p-6 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1208] dark:text-white">{viewingOrg.name}</h3>
                <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">Organization Details, Admins, Team Users, and KYC documents.</p>
              </div>
              <button 
                onClick={() => setViewingOrg(null)}
                className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white text-xs p-1 font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Scrollable details content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Grid 1: Basic Registration Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F5EDE2]/60 dark:bg-gray-950/30 p-4 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl text-xs">
                <div className="md:col-span-2 pb-2 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider">1. Profile & Registration Details</h4>
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-mono font-medium">Registered on {formatDate(viewingOrg.created_at)}</span>
                </div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Mandal Name: </span><span className="text-[#1A1208] dark:text-white font-bold">{viewingOrg.name}</span></div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Slug URL: </span><span className="text-[#1A1208] dark:text-gray-300 font-mono font-medium">/donate/{viewingOrg.slug}</span></div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Mandal Phone: </span><span className="text-[#1A1208] dark:text-gray-300 font-mono font-medium">{viewingOrg.phone || '—'}</span></div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">UPI ID for Donations: </span><span className="text-[#1A1208] dark:text-gray-300 font-mono font-medium">{viewingOrg.upi_id || '—'}</span></div>
                <div className="md:col-span-2"><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Address: </span><span className="text-[#1A1208] dark:text-gray-300 font-bold">{viewingOrg.address || '—'}, {viewingOrg.city || '—'} - {viewingOrg.pincode || '—'}</span></div>
              </div>

              {/* Grid 2: Account Administrator */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#F5EDE2]/60 dark:bg-gray-950/30 p-4 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl text-xs">
                <div className="md:col-span-3 pb-2 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider">2. Account Administrator</h4>
                  {viewingOrg.users?.find(u => u.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => openChangePasswordModal(viewingOrg.users?.find(u => u.role === 'admin')?.id || '', viewingOrg.admin_email)}
                      className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-[#F5EDE2] dark:hover:bg-gray-700 text-[#E8650A] dark:text-orange-400 border border-[#E8650A]/20 dark:border-gray-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                    >
                      Change Password
                    </button>
                  )}
                </div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Admin Name: </span><span className="text-[#1A1208] dark:text-white font-bold">{viewingOrg.admin_full_name || '—'}</span></div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Login Email: </span><span className="text-[#1A1208] dark:text-gray-300 font-mono font-medium">{viewingOrg.admin_email || '—'}</span></div>
                <div><span className="text-[#7a6a55] dark:text-gray-500 font-medium">Admin Phone: </span><span className="text-[#1A1208] dark:text-gray-300 font-mono font-medium">{viewingOrg.admin_phone || '—'}</span></div>
              </div>

              {/* Section 3: Documents (New layout with inline viewer and row buttons) */}
              <div className="space-y-3 bg-[#F5EDE2]/60 dark:bg-gray-950/20 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">3. Documents</h4>
                
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
                        <div key={doc.key} className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-950/40 px-2.5 py-1.5 border border-dashed border-[#1A1208]/20 dark:border-gray-800 rounded-xl text-[11px]">
                          <span className="text-[#7a6a55] dark:text-gray-500 font-bold">{doc.label} (No attachment)</span>
                          <button
                            type="button"
                            onClick={() => triggerUpload(doc.key)}
                            disabled={uploadingFile && uploadingDocKey === doc.key}
                            className="px-2 py-0.5 bg-[#E8650A]/10 hover:bg-[#E8650A]/20 text-[#E8650A] dark:text-orange-400 font-bold rounded text-[9px] border border-[#E8650A]/20 transition-colors cursor-pointer disabled:opacity-50"
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
                            ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20 border-transparent'
                            : 'bg-white dark:bg-gray-800 border-[#1A1208]/15 dark:border-gray-700 hover:bg-[#F5EDE2] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300'}`}
                      >
                        📄 {doc.label}
                      </button>
                    )
                  })}
                </div>

                {/* Inline document preview box */}
                {selectedDocUrl ? (
                  <div className="mt-4 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950 h-[350px] relative">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(selectedDocUrl, '_blank')}
                        className="px-2.5 py-1 bg-white/90 dark:bg-gray-900/80 hover:bg-[#F5EDE2] dark:hover:bg-gray-800/90 text-[#1A1208] dark:text-gray-300 rounded text-[9px] font-bold border border-[#1A1208]/10 dark:border-gray-700 transition-colors cursor-pointer"
                      >
                        External ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDocUrl('')
                          setSelectedDocKey('')
                        }}
                        className="px-2.5 py-1 bg-white/90 dark:bg-gray-900/80 hover:bg-[#F5EDE2] dark:hover:bg-gray-800/90 text-[#1A1208] dark:text-gray-300 rounded text-[9px] font-bold border border-[#1A1208]/10 dark:border-gray-700 transition-colors cursor-pointer"
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
                  <div className="mt-4 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 h-[100px] flex items-center justify-center text-xs text-[#7a6a55] dark:text-gray-500 font-mono font-medium">
                    <div className="w-5 h-5 rounded-full border border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin mr-2" />
                    Generating preview link...
                  </div>
                ) : null}
              </div>

              {/* Section 4: Team Members (moved after document section) */}
              <div className="space-y-3 bg-[#F5EDE2]/60 dark:bg-gray-950/20 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">4. Team Members ({viewingOrg.users?.length || 0})</h4>
                {(!viewingOrg.users || viewingOrg.users.length === 0) ? (
                  <p className="text-xs text-[#7a6a55] dark:text-gray-500 italic">No registered team members found for this organization.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 text-[10px] text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider font-bold">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Phone</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1208]/10 dark:divide-gray-800 text-[#1A1208] dark:text-gray-300 font-medium">
                        {viewingOrg.users.map(u => (
                          <tr key={u.id} className="hover:bg-[#F5EDE2]/50 dark:hover:bg-gray-900/30">
                            <td className="py-2.5 px-3 font-bold text-[#1A1208] dark:text-white">{u.full_name || '—'}</td>
                            <td className="py-2.5 px-3 font-mono">{u.phone || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                ${u.role === 'admin' 
                                  ? 'bg-amber-500/10 text-[#E8650A] dark:text-amber-450 border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => fetchUserDetailedInfo(u.id)}
                                className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-[#F5EDE2] dark:hover:bg-gray-700 border border-[#1A1208]/15 dark:border-gray-700 text-[#E8650A] dark:text-orange-400 font-bold rounded-xl text-[10px] transition-colors cursor-pointer"
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
              <div className="space-y-3 bg-[#F5EDE2]/60 dark:bg-gray-950/20 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4">
                <h4 className="text-xs font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider block">5. Organization Events ({orgEvents.length})</h4>
                {loadingEvents ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                    <div className="w-5 h-5 rounded-full border border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
                    <p className="text-[10px] text-[#7a6a55] dark:text-gray-500 font-mono">Fetching events...</p>
                  </div>
                ) : orgEvents.length === 0 ? (
                  <p className="text-xs text-[#7a6a55] dark:text-gray-500 italic">No events found for this organization.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 text-[10px] text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider font-bold">
                          <th className="py-2 px-3">Event Name</th>
                          <th className="py-2 px-3">UPI ID</th>
                          <th className="py-2 px-3">Dates</th>
                          <th className="py-2 px-3 text-center">Status</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A1208]/10 dark:divide-gray-800 text-[#1A1208] dark:text-gray-300 font-medium">
                        {orgEvents.map(ev => {
                          const today = new Date().toISOString().split('T')[0]
                          const isExpired = ev.end_date < today
                          const isSuspended = ev.is_suspended

                          return (
                            <tr key={ev.id} className="hover:bg-[#F5EDE2]/50 dark:hover:bg-gray-900/30">
                              <td className="py-2.5 px-3 font-bold text-[#1A1208] dark:text-white">
                                {ev.name} {ev.year}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{ev.upi_id || '—'}</td>
                              <td className="py-2.5 px-3 text-[#7a6a55] dark:text-gray-400">
                                {ev.start_date} to {ev.end_date}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                                  ${isSuspended
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20'
                                    : isExpired
                                      ? 'bg-gray-500/10 text-[#7a6a55] dark:text-gray-500 border-gray-500/20'
                                      : ev.is_active
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                                        : 'bg-amber-500/10 text-[#E8650A] dark:text-amber-400 border-amber-500/20'}`}>
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
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-455 border-rose-500/20'}`}
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
            <div className="p-6 border-t border-[#1A1208]/10 dark:border-gray-800 flex justify-end bg-[#F5EDE2] dark:bg-gray-950/20">
              <button
                type="button"
                onClick={() => setViewingOrg(null)}
                className="px-5 py-2.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub Window File Previewer Overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">KYC Document Preview</h3>
                <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 font-mono tracking-wide mt-0.5">{previewDoc.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-3 py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Content - Iframe or Image */}
            <div className="flex-1 bg-[#F5EDE2]/40 dark:bg-gray-950 flex items-center justify-center overflow-hidden p-2 relative">
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
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#E8650A] dark:text-amber-400 flex items-center justify-center text-3xl mx-auto animate-bounce">
                    📄
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-[#1A1208] dark:text-white">Demo File (Mock Preview Mode)</p>
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 leading-relaxed font-medium">
                      No document path was attached to this mock registration. Displaying dummy placeholder contents for Super Admin preview validation.
                    </p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl text-left text-[11px] font-mono text-[#7a6a55] dark:text-gray-400 space-y-1">
                    <p className="text-[10px] font-bold text-[#7a6a55] dark:text-gray-500 uppercase tracking-wide">System Metadata</p>
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
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">Team Member Profile</h3>
                <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 font-mono tracking-wide mt-0.5">Super Admin Audit View</p>
              </div>
              <button 
                onClick={() => setShowDetailedUserModal(false)}
                className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white text-xs p-1 cursor-pointer font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {loadingDetailedUser ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <div className="w-6 h-6 rounded-full border border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
                  <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 font-mono">Fetching profile details...</p>
                </div>
              ) : detailedUser ? (
                <div className="space-y-4">
                  {/* Basic Card */}
                  <div className="bg-[#F5EDE2]/60 dark:bg-gray-950/40 border border-[#1A1208]/10 dark:border-gray-800 p-4 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center pb-2 border-b border-[#1A1208]/10 dark:border-gray-800">
                      <div>
                        <p className="text-sm font-bold text-[#1A1208] dark:text-white">{detailedUser.full_name}</p>
                        <p className="text-[9px] text-[#E8650A] dark:text-orange-400 font-mono tracking-wider uppercase leading-none mt-0.5 font-bold">
                          {detailedUser.designation}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border
                        ${detailedUser.is_active 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'}`}>
                        {detailedUser.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px] text-[#1A1208] dark:text-gray-300 font-medium">
                      <div>
                        <span className="text-[#7a6a55] dark:text-gray-400 block text-[9px] font-bold uppercase tracking-wider">Email Address</span>
                        <span className="font-mono text-[#1A1208] dark:text-white truncate block">{detailedUser.email}</span>
                      </div>
                      <div>
                        <span className="text-[#7a6a55] dark:text-gray-400 block text-[9px] font-bold uppercase tracking-wider">Phone Number</span>
                        <span className="font-mono text-[#1A1208] dark:text-white block">{detailedUser.phone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#7a6a55] dark:text-gray-400 block text-[9px] font-bold uppercase tracking-wider">System Role</span>
                        <span className="capitalize block font-bold">{detailedUser.role}</span>
                      </div>
                      <div>
                        <span className="text-[#7a6a55] dark:text-gray-400 block text-[9px] font-bold uppercase tracking-wider">Joined Date</span>
                        <span>{detailedUser.created_at ? formatDate(detailedUser.created_at) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Security / Logs Card */}
                  <div className="bg-[#F5EDE2]/60 dark:bg-gray-950/40 border border-[#1A1208]/10 dark:border-gray-800 p-4 rounded-xl space-y-2 text-[11px]">
                    <h4 className="text-[9px] font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider border-b border-[#1A1208]/10 dark:border-gray-800 pb-1.5 mb-2.5">
                      Security & Login Info
                    </h4>
                    <div className="space-y-2 font-medium">
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a6a55] dark:text-gray-400">Last Login:</span>
                        <span className="font-mono text-[#1A1208] dark:text-white text-right">
                          {detailedUser.last_login ? new Date(detailedUser.last_login).toLocaleString('en-IN') : 'Never logged in'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#7a6a55] dark:text-gray-400">Profile / Password Update:</span>
                        <span className="font-mono text-[#1A1208] dark:text-white text-right">
                          {detailedUser.password_change ? new Date(detailedUser.password_change).toLocaleString('en-IN') : 'No password updates'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#1A1208]/10 dark:border-gray-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => openChangePasswordModal(detailedUser.id, detailedUser.email)}
                          className="px-2.5 py-1.5 bg-white dark:bg-gray-800 hover:bg-[#F5EDE2] dark:hover:bg-gray-700 border border-[#1A1208]/15 dark:border-gray-700 text-[#E8650A] dark:text-orange-400 font-bold rounded-lg text-[9px] transition-colors cursor-pointer"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collection Activity Card */}
                  <div className="bg-[#F5EDE2]/60 dark:bg-gray-950/40 border border-[#1A1208]/10 dark:border-gray-800 p-4 rounded-xl space-y-2 text-[11px]">
                    <h4 className="text-[9px] font-extrabold text-[#E8650A] dark:text-orange-400 uppercase tracking-wider border-b border-[#1A1208]/10 dark:border-gray-800 pb-1.5 mb-2.5">
                      Collection Activity
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-white dark:bg-gray-900 p-2.5 border border-[#1A1208]/10 dark:border-gray-800 rounded-lg">
                        <p className="text-[9px] text-[#7a6a55] dark:text-gray-400 font-bold uppercase tracking-wider">Total Collected</p>
                        <p className="text-xs font-black text-[#1A1208] dark:text-white mt-1">{detailedUser.activity.totalCount} donations</p>
                        <p className="text-[10px] font-mono text-[#E8650A] dark:text-orange-400 mt-0.5 font-bold">₹{detailedUser.activity.totalAmount}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2.5 border border-[#1A1208]/10 dark:border-gray-800 rounded-lg">
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Verified Cash</p>
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1">{detailedUser.activity.verifiedCount} items</p>
                        <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">₹{detailedUser.activity.verifiedAmount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[#7a6a55] dark:text-gray-400 text-center py-6">Could not load profile info.</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#1A1208]/10 dark:border-gray-800 bg-[#F5EDE2] dark:bg-gray-950/20 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailedUserModal(false)}
                className="px-4 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal with OTP Flow */}
      {resetPasswordUserId && (
        <div className="fixed inset-0 z-55 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-[#1A1208]/10 dark:border-gray-800 flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-950/20">
              <div>
                <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">Change Admin Password</h3>
                <p className="text-[10px] text-[#7a6a55] dark:text-gray-400 font-mono mt-0.5">
                  Target: {resetPasswordEmail || 'Admin Account'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setResetPasswordUserId(null)
                  setNewPasswordValue('')
                  setResetPasswordStep(1)
                  setResetOtpVerified(false)
                }}
                className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white text-xs p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Step Indicators */}
            <div className="px-5 pt-4 flex items-center justify-between border-b border-[#1A1208]/10 dark:border-gray-800 pb-3 text-[10px] font-bold font-mono">
              <span className={resetPasswordStep === 1 ? 'text-[#E8650A]' : 'text-gray-400'}>1. Send OTP</span>
              <span>→</span>
              <span className={resetPasswordStep === 2 ? 'text-[#E8650A]' : 'text-gray-400'}>2. Verify OTP</span>
              <span>→</span>
              <span className={resetPasswordStep === 3 ? 'text-[#E8650A]' : 'text-gray-400'}>3. Set Password</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Error Message */}
              {resetOtpError && (
                <div className="bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs rounded-xl p-3 flex items-start space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{resetOtpError}</span>
                </div>
              )}

              {/* Success Message */}
              {resetOtpSuccessMsg && !resetOtpError && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl p-3 flex items-center space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{resetOtpSuccessMsg}</span>
                </div>
              )}

              {/* STEP 1: SEND OTP */}
              {resetPasswordStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300">
                      Admin Email Address *
                    </label>
                    <input
                      type="email"
                      readOnly
                      value={resetPasswordEmail}
                      placeholder="admin@mandal.com"
                      className="w-full bg-[#F5EDE2]/50 dark:bg-gray-800/50 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white font-mono font-bold cursor-not-allowed select-none opacity-90 focus:outline-none"
                    />
                  </div>

                  <p className="text-[11px] text-[#7a6a55] dark:text-gray-400 leading-relaxed">
                    We will send a 6-digit OTP verification code to the email address above.
                  </p>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetPasswordUserId(null)
                        setNewPasswordValue('')
                      }}
                      className="px-4 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendChangePasswordOtp}
                      disabled={resetOtpLoading || !resetPasswordEmail.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-[#E8650A]/20"
                    >
                      {resetOtpLoading ? 'Sending OTP...' : 'Send OTP Code'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: VERIFY OTP */}
              {resetPasswordStep === 2 && (
                <form onSubmit={handleVerifyChangePasswordOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300">Enter 6-Digit OTP *</label>
                    <div className="flex justify-center items-center gap-1 xs:gap-1.5 sm:gap-2 w-full">
                      {resetOtpCode.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`change-pass-otp-${idx}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleResetOtpKeyDown(idx, e)}
                          onPaste={idx === 0 ? handleResetOtpPaste : undefined}
                          className="w-8 h-10 xs:w-9 xs:h-11 sm:w-10 sm:h-12 flex-1 max-w-[40px] text-center text-base sm:text-lg font-bold font-mono bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg text-[#1A1208] dark:text-white focus:outline-none focus:border-[#E8650A] p-0"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#7a6a55] dark:text-gray-400 flex-wrap gap-2">
                    <span>Didn&apos;t receive code?</span>
                    {resetCooldownTimer > 0 ? (
                      <span className="font-mono text-[#E8650A]">Resend in {resetCooldownTimer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendChangePasswordOtp}
                        className="font-bold text-[#E8650A] hover:underline cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setResetPasswordStep(1)}
                      className="px-3 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={resetOtpLoading}
                      className="px-4 py-2 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-[#E8650A]/20"
                    >
                      {resetOtpLoading ? 'Verifying...' : 'Verify OTP Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: SET NEW PASSWORD */}
              {resetPasswordStep === 3 && (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#7a6a55] dark:text-gray-300 mb-1.5">New Password *</label>
                    <input
                      type="text"
                      required
                      placeholder="Min 8 characters"
                      value={newPasswordValue}
                      onChange={e => setNewPasswordValue(e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-mono font-medium"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetPasswordUserId(null)
                        setNewPasswordValue('')
                        setResetPasswordStep(1)
                        setResetOtpVerified(false)
                      }}
                      className="px-4 py-2 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resettingPassword || newPasswordValue.length < 8}
                      className="px-4 py-2 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-[#E8650A]/20"
                    >
                      {resettingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}

            </div>
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
