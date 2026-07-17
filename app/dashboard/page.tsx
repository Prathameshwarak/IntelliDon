'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { isSubscriptionExpired } from '@/lib/subscription'
import { useSubscription } from '@/lib/useSubscription'
import UpgradeBanner from '@/components/UpgradeBanner'
import KycVerificationPanel from '@/components/dashboard/KycVerificationPanel'

// ── TESTING / MIGRATION CONFIGURATION ──────────────────────────
// Set to true to bypass KYC blocks and mandatory document upload popups (for testing / old accounts migration).
// Toggle to false for production compliance enforcement.
const BYPASS_KYC_VERIFICATION = true

// ── Types ──────────────────────────────────────────────────────
type Tab = 'donations' | 'ranking' | 'history' | 'events' | 'team'

type Donation = {
  id: string
  receipt_number: string
  donor_name: string
  donor_phone: string
  donor_address: string | null
  amount: number
  payment_mode: string
  status: string
  screenshot_url: string | null
  created_at: string
  users: { full_name: string } | null
  pdf_url: string | null
  collected_by: string | null
  rejection_reason: string | null
}

type Summary = {
  total_count: number
  total_amount: number
  verified_amount: number
  pending_count: number
}

type Event = {
  id: string
  name: string
  year: number
  upi_id: string | null
  start_date: string   // ← ADD
  end_date: string     // ← ADD
  is_active: boolean
  is_expired: boolean  // ← ADD (returned by API)
  days_remaining: number // ← ADD (returned by API)
  is_suspended?: boolean
}

type Member = {
  id: string
  full_name: string
  phone: string
  role: string
  is_active: boolean
}

interface CollectorGroup {
  id: string
  name: string
  donations: Donation[]
  totalCash: number
  pendingCash: number
  totalUpi: number
  pendingUpi: number
}

// ── Role capability map — single source of truth ───────────────
// Change permissions here and the entire UI updates automatically
const CAN = {
  verifyDonation:  (role: string) => ['admin', 'manager'].includes(role),
  createEvent:     (role: string) => role === 'admin',
  toggleEvent:     (role: string) => role === 'admin',
  addMember:       (role: string) => role === 'admin',
  removeMember:    (role: string) => role === 'admin',
  seeTeamTab:      (role: string) => role === 'admin',   // manager cannot manage team
  seeEventsTab:    (role: string) => ['admin', 'manager'].includes(role),
}

export default function DashboardPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')
  const [mandalKyc, setMandalKyc] = useState<any>(null)

  // Default tab — manager only sees donations, admin sees all
  const [tab, setTab] = useState<Tab>('donations')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Donations state
  const [donations, setDonations] = useState<Donation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [activeScreenshot, setActiveScreenshot] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [screenshotChecked, setScreenshotChecked] = useState(false)
  const [isSelfDrawerOpen, setIsSelfDrawerOpen] = useState(false)
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingRejection, setSubmittingRejection] = useState(false)
  const [bulkVerifyingCollector, setBulkVerifyingCollector] = useState<string | null>(null)
  const [bulkVerifyingMode, setBulkVerifyingMode] = useState<string | null>(null)
  const [expandedCollectors, setExpandedCollectors] = useState<Record<string, boolean>>({})
  const [historySearch, setHistorySearch] = useState('')
  const [historyCollectorFilter, setHistoryCollectorFilter] = useState('all')
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all')
  //line added by pratham:
  const [rankingSubTab, setRankingSubTab] = useState<'collectors' | 'donors'>('collectors')
  const [bulkVerifyModalCollector, setBulkVerifyModalCollector] = useState<CollectorGroup | null>(null)

  // Events state
  const [events, setEvents] = useState<Event[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventYear, setEventYear] = useState(new Date().getFullYear().toString())
  const [eventUpiId, setEventUpiId] = useState('')
  const [eventSubmitting, setEventSubmitting] = useState(false)
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [dateError, setDateError] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  // CSV Export handler
  const handleExportCSV = (donationsToExport: Donation[], filename = 'collection_history.csv') => {
    const headers = ['Receipt Number', 'Donor Name', 'Phone', 'Address', 'Amount', 'Collector', 'Payment Mode', 'Status', 'Date']
    const rows = donationsToExport.map(d => [
      d.receipt_number,
      d.donor_name,
      d.donor_phone || '',
      d.donor_address || '',
      d.amount,
      d.payment_mode === 'upi_self' ? 'Self' : (d.users?.full_name || 'Unknown'),
      d.payment_mode === 'cash' ? 'Cash' : d.payment_mode === 'upi_self' ? 'UPI (Self)' : 'UPI (Collector)',
      d.status,
      new Date(d.created_at).toLocaleString('en-IN')
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const strVal = String(val)
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`
        }
        return strVal
      }).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // PDF Export handler
  const handleExportPDF = (donationsToExport: Donation[], title = 'Collection History Report') => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site to download the PDF report.')
      return
    }

    const totalAmount = donationsToExport.reduce((sum, d) => sum + Number(d.amount), 0)
    const verifiedAmount = donationsToExport.filter(d => d.status === 'verified').reduce((sum, d) => sum + Number(d.amount), 0)
    const pendingAmount = donationsToExport.filter(d => d.status === 'pending').reduce((sum, d) => sum + Number(d.amount), 0)

    const tableRows = donationsToExport.map(d => `
      <tr>
        <td>${d.receipt_number}</td>
        <td>${d.donor_name}</td>
        <td>${d.donor_phone || '—'}</td>
        <td>₹${Number(d.amount).toLocaleString('en-IN')}</td>
        <td>${d.payment_mode === 'upi_self' ? 'Self' : (d.users?.full_name || 'Unknown')}</td>
        <td class="capitalize">${d.payment_mode.replace('_', ' ')}</td>
        <td class="status-${d.status}">${d.status.toUpperCase()}</td>
        <td>${new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; margin: 0; }
            .header { margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; color: #e8650a; }
            .mandal { font-size: 14px; color: #4a5568; margin-top: 4px; }
            .summary { display: grid; grid-template-cols: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
            .summary-card { background: #f7fafc; border: 1px solid #edf2f7; padding: 12px; border-radius: 8px; }
            .summary-label { font-size: 10px; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
            .summary-value { font-size: 18px; font-weight: bold; margin-top: 4px; color: #1a202c; }
            table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-top: 12px; }
            th { background: #edf2f7; color: #4a5568; font-weight: 600; padding: 10px; border-bottom: 1px solid #e2e8f0; }
            td { padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748; }
            tr:nth-child(even) { background: #fcfcfc; }
            .status-verified { color: #2f855a; font-weight: 600; }
            .status-pending { color: #c05621; font-weight: 600; }
            .status-rejected { color: #9b2c2c; font-weight: 600; }
            .footer { margin-top: 40px; font-size: 10px; color: #a0aec0; text-align: center; border-top: 1px solid #edf2f7; padding-top: 12px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${title}</h1>
            <div class="mandal">${mandalName || 'Intellidon Mandal'} · Generated on ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
          <div class="summary">
            <div class="summary-card">
              <div class="summary-label">Total Filtered Amount</div>
              <div class="summary-value">₹${totalAmount.toLocaleString('en-IN')}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Verified Amount</div>
              <div class="summary-value">₹${verifiedAmount.toLocaleString('en-IN')}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Donation Count</div>
              <div class="summary-value">${donationsToExport.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Donor Name</th>
                <th>Phone</th>
                <th>Amount</th>
                <th>Collector</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Generated via Intellidon Donation System. All values verified against official digital ledgers.
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Team state
  const [members, setMembers] = useState<Member[]>([])
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberPhone, setMemberPhone] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [memberRole, setMemberRole] = useState<'collector' | 'manager'>('collector')
  const [memberSubmitting, setMemberSubmitting] = useState(false)

  // Edit / Reset Password states
  const [editUser, setEditUser] = useState<Member | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<'collector' | 'manager'>('collector')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const [resetPasswordUser, setResetPasswordUser] = useState<Member | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [showPasswordUpdatedModal, setShowPasswordUpdatedModal] = useState(false)
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false)

  // ── Subscription state ────────────────────────────────────────
  const sub = useSubscription(mandalId)
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [pendingVerifyId, setPendingVerifyId] = useState<string | null>(null)
  const [pendingBulkCollector, setPendingBulkCollector] = useState<{ id: string; mode: 'cash' | 'upi_collector' } | null>(null)

  // ── Security & KYC gates ──────────────────────────────────────
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({
    doc_admin_aadhaar: null,
    doc_bank_proof: null,
    doc_auth_letter: null,
    doc_address_proof: null
  })
  const [uploadingKyc, setUploadingKyc] = useState(false)

  async function handleMandatoryPasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { requires_password_change: false }
      })
      if (error) throw error
      
      showToast('Password changed successfully!', 'success')
      setRequiresPasswordChange(false)
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleKycPopupUpload(e: React.FormEvent) {
    e.preventDefault()
    
    const missingDocs = []
    if (mandalKyc) {
      if (!mandalKyc.doc_admin_aadhaar && !kycFiles.doc_admin_aadhaar) missingDocs.push('Admin Aadhaar')
      if (!mandalKyc.doc_bank_proof && !kycFiles.doc_bank_proof) missingDocs.push('Bank Proof')
      if (!mandalKyc.doc_auth_letter && !kycFiles.doc_auth_letter) missingDocs.push('Committee Authorisation Letter')
      if (!mandalKyc.doc_address_proof && !kycFiles.doc_address_proof) missingDocs.push('Address Proof')
    }

    if (missingDocs.length > 0) {
      showToast(`Please select: ${missingDocs.join(', ')}`, 'error')
      return
    }
    
    setUploadingKyc(true)
    try {
      const updates: Record<string, string> = {}
      
      for (const [field, file] of Object.entries(kycFiles)) {
        if (!file) continue
        const ext = file.name.split('.').pop() || 'pdf'
        const path = `${mandalId}/${field}.${ext}`
        
        const { error: uploadError } = await supabase.storage
          .from('kyc-documents')
          .upload(path, file, { upsert: true })
          
        if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        
        updates[field] = path
      }
      
      const { error: dbError } = await supabase
        .from('mandals')
        .update(updates)
        .eq('id', mandalId)
        
      if (dbError) throw dbError
      
      showToast('KYC Documents uploaded successfully!', 'success')
      setMandalKyc((prev: any) => prev ? { ...prev, ...updates } : prev)
    } catch (err: any) {
      showToast(err.message || 'Failed to upload documents', 'error')
    } finally {
      setUploadingKyc(false)
    }
  }

  async function initDashboard() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: userRow } = await supabase
      .from('users')
      .select('role, mandal_id')
      .eq('id', user.id)
      .single()

    // Only admin and manager reach this page
    if (!userRow || !['admin', 'manager'].includes(userRow.role)) {
      if (userRow?.role === 'collector') router.push('/collect')
      else if (userRow?.role === 'super_admin') router.push('/super-admin')
      else router.push('/login')
      return
    }

    const { data: mandal } = await supabase
      .from('mandals')
      .select('*')
      .eq('id', userRow.mandal_id)
      .single()

    setUserId(user.id)
    setUserRole(userRow.role)
    setMandalId(userRow.mandal_id)
    setMandalName(mandal?.name || '')
    setMandalKyc(mandal)

    if (user.user_metadata?.requires_password_change) {
      setRequiresPasswordChange(true)
    }

    setLoading(false)
  }

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    initDashboard()
  }, [router])

  // ── Load data on tab change ───────────────────────────────────
  useEffect(() => {
    if (!mandalId) return
    if (tab === 'donations') fetchDonations()
    if (tab === 'events') fetchEvents()
    if (tab === 'team') fetchTeam()
  }, [tab, mandalId])

  // ── Donations ─────────────────────────────────────────────────
  async function fetchDonations() {
    setDonationsLoading(true)
    const res = await fetch(`/api/donations?mandal_id=${mandalId}`)
    const data = await res.json()
    if (!data.error) {
      setDonations(data.donations)
      setSummary(data.summary)
    }
    setDonationsLoading(false)
  }

  async function verifyDonation(donationId: string) {
    if (!CAN.verifyDonation(userRole)) return
    // If subscription expired, show upgrade banner first
    if (sub.isExpired) {
      setPendingVerifyId(donationId)
      setShowUpgradeBanner(true)
      return
    }
    setVerifyingId(donationId)
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donation_id: donationId, verified_by: userId, status: 'verified' })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Donation verified — receipt generated', 'success')
      setDonations(prev => prev.map(d =>
        d.id === donationId
          ? { ...d, status: 'verified', pdf_url: data.pdf_url || d.pdf_url, rejection_reason: null }
          : d
      ))
      fetchDonations()
      // Close the review panel
      setReviewingId(null)
      setScreenshotChecked(false)
    } else {
      showToast(data.error || 'Could not verify', 'error')
    }
    setVerifyingId(null)
  }

  async function rejectDonation(donationId: string, reason: string) {
    if (!CAN.verifyDonation(userRole)) return
    setSubmittingRejection(true)
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donation_id: donationId,
        verified_by: userId,
        status: 'rejected',
        rejection_reason: reason
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Donation rejected', 'success')
      setDonations(prev => prev.map(d =>
        d.id === donationId
          ? { ...d, status: 'rejected', rejection_reason: reason }
          : d
      ))
      fetchDonations()
      setRejectionModalId(null)
      setRejectionReason('')
      setReviewingId(null)
      setScreenshotChecked(false)
    } else {
      showToast(data.error || 'Could not reject', 'error')
    }
    setSubmittingRejection(false)
  }

  async function verifyCollectorBulk(collectorId: string, paymentMode: 'cash' | 'upi_collector') {
    if (!CAN.verifyDonation(userRole)) return
    // If subscription expired, show upgrade banner first
    if (sub.isExpired) {
      setPendingBulkCollector({ id: collectorId, mode: paymentMode })
      setShowUpgradeBanner(true)
      return
    }
    if (!confirm(`Are you sure you want to verify all pending ${paymentMode === 'cash' ? 'Cash' : 'UPI'} collections for this collector?`)) return
    
    setBulkVerifyModalCollector(null)
    setBulkVerifyingCollector(collectorId)
    setBulkVerifyingMode(paymentMode)

    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collector_id: collectorId,
        payment_mode: paymentMode,
        verified_by: userId
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast(`All pending ${paymentMode === 'cash' ? 'Cash' : 'UPI'} collections verified`, 'success')
      const verifiedIds = data.verified_ids || []
      setDonations(prev => prev.map(d =>
        verifiedIds.includes(d.id) ? { ...d, status: 'verified' } : d
      ))
      fetchDonations()
    } else {
      showToast(data.error || 'Could not verify', 'error')
    }
    setBulkVerifyingCollector(null)
    setBulkVerifyingMode(null)
  }

  // ── Events ────────────────────────────────────────────────────
  async function fetchEvents() {
    const res = await fetch(`/api/events?mandal_id=${mandalId}`)
    const data = await res.json()
    if (!data.error) setEvents(data.events)
  }

  async function createEvent() {
    if (!CAN.createEvent(userRole)) return
    setDateError('')

    // Client-side validation — matches server rules
    if (!eventName.trim()) { showToast('Event name is required', 'error'); return }
    if (!eventUpiId.trim()) { showToast('UPI ID is required', 'error'); return }
    if (!eventStartDate) { showToast('Start date is required', 'error'); return }
    if (!eventEndDate) { showToast('End date is required', 'error'); return }

    const start = new Date(eventStartDate)
    const end = new Date(eventEndDate)
    const today = new Date(); today.setHours(0,0,0,0)

    if (end <= start) { setDateError('End date must be after start date'); return }

    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 50) { setDateError(`Duration is ${days} days — maximum is 50 days`); return }
    if (start < today) { setDateError('Start date cannot be in the past'); return }

    setEventSubmitting(true)
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandal_id: mandalId,
        name: eventName,
        year: eventYear,
        upi_id: eventUpiId,
        start_date: eventStartDate,
        end_date: eventEndDate
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Event created', 'success')
      const newEvent = data.event
      setEvents(prev => {
        // Deactivate all other events in client state if the newly created event is active
        const updated = prev.map(e => newEvent.is_active ? { ...e, is_active: false } : e)
        return [newEvent, ...updated]
      })
      setEventName(''); setEventYear(new Date().getFullYear().toString())
      setEventUpiId(''); setEventStartDate(''); setEventEndDate('')
      setDateError(''); setShowEventForm(false)
    } else showToast(data.error || 'Could not create event', 'error')
    setEventSubmitting(false)
  }

  async function toggleEvent(eventId: string, currentActive: boolean) {
    if (!CAN.toggleEvent(userRole)) return
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, is_active: !currentActive })
    })
    const data = await res.json()
    if (data.success) {
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) {
          return { ...e, is_active: !currentActive }
        } else if (!currentActive) {
          // If we activated this event, deactivate all other events in frontend state
          return { ...e, is_active: false }
        }
        return e
      }))
      showToast(`Event ${!currentActive ? 'activated' : 'deactivated'}`, 'success')
    } else {
      showToast(data.error || 'Could not update event', 'error')
    }
  }

  function startEditingEvent(ev: Event) {
    setEditingEventId(ev.id)
    setEventName(ev.name)
    setEventYear(ev.year.toString())
    setEventUpiId(ev.upi_id || '')
    setEventStartDate(ev.start_date)
    setEventEndDate(ev.end_date)
    setDateError('')
    setShowEventForm(true)
  }

  function cancelEventForm() {
    setEditingEventId(null)
    setEventName('')
    setEventYear(new Date().getFullYear().toString())
    setEventUpiId('')
    setEventStartDate('')
    setEventEndDate('')
    setDateError('')
    setShowEventForm(false)
  }

  async function updateEvent() {
    if (!CAN.createEvent(userRole) || !editingEventId) return
    setDateError('')

    if (!eventName.trim()) { showToast('Event name is required', 'error'); return }
    if (!eventUpiId.trim()) { showToast('UPI ID is required', 'error'); return }
    if (!eventStartDate) { showToast('Start date is required', 'error'); return }
    if (!eventEndDate) { showToast('End date is required', 'error'); return }

    const start = new Date(eventStartDate)
    const end = new Date(eventEndDate)

    if (end <= start) { setDateError('End date must be after start date'); return }

    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 50) { setDateError(`Duration is ${days} days — maximum is 50 days`); return }

    const originalEvent = events.find(e => e.id === editingEventId)
    const today = new Date(); today.setHours(0,0,0,0)
    if (originalEvent && eventStartDate !== originalEvent.start_date && start < today) {
      setDateError('Start date cannot be in the past')
      return
    }

    setEventSubmitting(true)
    const res = await fetch('/api/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: editingEventId,
        name: eventName,
        year: eventYear,
        upi_id: eventUpiId,
        start_date: eventStartDate,
        end_date: eventEndDate
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Event updated', 'success')
      const updatedEvent = data.event
      setEvents(prev => prev.map(e => {
        if (e.id === updatedEvent.id) {
          return updatedEvent
        }
        if (updatedEvent.is_active) {
          return { ...e, is_active: false }
        }
        return e
      }))
      cancelEventForm()
    } else {
      showToast(data.error || 'Could not update event', 'error')
    }
    setEventSubmitting(false)
  }

  // ── Team ──────────────────────────────────────────────────────
  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }

  async function fetchTeam() {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/team?mandal_id=${mandalId}`, { headers })
    const data = await res.json()
    if (!data.error) setMembers(data.members)
  }

  async function addMember() {
    if (!CAN.addMember(userRole)) return
    if (!memberName || !memberPhone || !memberEmail || !memberPassword) {
      showToast('All fields required', 'error'); return
    }
    if (memberPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    setMemberSubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/team', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mandal_id: mandalId, full_name: memberName, phone: memberPhone, email: memberEmail, password: memberPassword, role: memberRole })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Member added', 'success')
      setMembers(prev => [...prev, data.member])
      setMemberName(''); setMemberPhone(''); setMemberEmail(''); setMemberPassword('')
      setShowMemberForm(false)
    } else showToast(data.error || 'Could not add member', 'error')
    setMemberSubmitting(false)
  }

  async function removeMember(memberId: string) {
    if (!CAN.removeMember(userRole)) return
    if (!confirm('Remove this member? They will lose access immediately.')) return
    const headers = await getAuthHeaders()
    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ user_id: memberId })
    })
    const data = await res.json()
    if (data.success) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
      showToast('Member removed', 'success')
    } else showToast('Could not remove member', 'error')
  }

  async function toggleMemberStatus(member: Member) {
    if (!CAN.removeMember(userRole)) return
    const newStatus = !member.is_active
    const actionLabel = newStatus ? 'activate' : 'deactivate'
    if (!confirm(`Are you sure you want to ${actionLabel} this member?`)) return

    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'toggle_status',
          user_id: member.id,
          is_active: newStatus
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Member ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success')
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: newStatus } : m))
      } else {
        showToast(data.error || `Could not ${actionLabel} member`, 'error')
      }
    } catch (err) {
      showToast('Something went wrong', 'error')
    }
  }

  function openEditModal(member: Member) {
    setEditUser(member)
    setEditName(member.full_name)
    setEditPhone(member.phone)
    setEditRole(member.role as 'collector' | 'manager')
  }

  async function updateMember() {
    if (!editUser) return
    if (!editName || !editPhone || !editRole) {
      showToast('All fields required', 'error'); return
    }
    setEditSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'edit',
          user_id: editUser.id,
          full_name: editName,
          phone: editPhone,
          role: editRole
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Member details updated', 'success')
        setMembers(prev => prev.map(m => m.id === editUser.id ? data.member : m))
        setEditUser(null)
      } else {
        showToast(data.error || 'Could not update member', 'error')
      }
    } catch (err) {
      showToast('Something went wrong', 'error')
    }
    setEditSubmitting(false)
  }

  function openResetPasswordModal(member: Member) {
    setResetPasswordUser(member)
    setTempPassword('')
  }

  function handleGeneratePassword() {
    const length = 11;
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '#@$%&*!';
    
    let chars = '';
    const firstUpper = uppercase[Math.floor(Math.random() * uppercase.length)];
    const firstLower = lowercase[Math.floor(Math.random() * lowercase.length)];
    const firstNumber = numbers[Math.floor(Math.random() * numbers.length)];
    const firstSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    const all = uppercase + lowercase + numbers + symbols;
    for (let i = 4; i < length; i++) {
      chars += all[Math.floor(Math.random() * all.length)];
    }
    
    const passwordArray = [firstUpper, firstLower, firstNumber, firstSymbol, ...chars.split('')];
    const generated = passwordArray.sort(() => 0.5 - Math.random()).join('');
    
    setTempPassword(generated)
  }

  async function resetPassword() {
    if (!resetPasswordUser) return
    const hasLength = tempPassword.length >= 8
    const hasUpper = /[A-Z]/.test(tempPassword)
    const hasLower = /[a-z]/.test(tempPassword)
    const hasNumber = /[0-9]/.test(tempPassword)
    const hasSpecial = /[^A-Za-z0-9]/.test(tempPassword)

    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      showToast('Password does not meet complexity requirements', 'error')
      return
    }
    setResetPasswordSubmitting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/team/reset-password', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          user_id: resetPasswordUser.id,
          new_password: tempPassword
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('Password reset successfully.', 'success')
        setGeneratedPassword(tempPassword)
        setResetPasswordUser(null)
        setShowPasswordUpdatedModal(true)
      } else {
        showToast(data.error || 'Could not reset password', 'error')
      }
    } catch (err) {
      showToast('Something went wrong', 'error')
    }
    setResetPasswordSubmitting(false)
  }

  // ── Helpers ───────────────────────────────────────────────────
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatAmount(n: number) {
    return '₹' + Number(n).toLocaleString('en-IN')
  }

  function paymentModeLabel(mode: string) {
    if (mode === 'cash') return '💵 Cash'
    if (mode === 'upi_collector') return '📱 UPI (collector)'
    if (mode === 'upi_self') return '📱 UPI (self)'
    return mode
  }

  // ── Categorize & Group Donations ─────────────────────────────
  const selfDonations = donations.filter(d => d.payment_mode === 'upi_self')
  const nonSelfDonations = donations.filter(d => d.payment_mode !== 'upi_self')

  // Calculate stats for non-self (collector) donations
  const collectorTotalCount = nonSelfDonations.length
  const collectorTotalAmount = nonSelfDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const collectorVerifiedAmount = nonSelfDonations
    .filter(d => d.status === 'verified')
    .reduce((sum, d) => sum + Number(d.amount), 0)
  const collectorPendingCount = nonSelfDonations.filter(d => d.status === 'pending').length

  // Calculate stats for self donations
  const selfTotalCount = selfDonations.length
  const selfTotalAmount = selfDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const selfVerifiedAmount = selfDonations
    .filter(d => d.status === 'verified')
    .reduce((sum, d) => sum + Number(d.amount), 0)
  const selfPendingCount = selfDonations.filter(d => d.status === 'pending').length

  // Unified summary calculations
  const totalVerifiedCount = donations.filter(d => d.status === 'verified').length
  const totalAmount = donations.filter(d => d.status === 'verified').reduce((sum, d) => sum + Number(d.amount), 0)
  const totalPendingAmount = donations.filter(d => d.status === 'pending').reduce((sum, d) => sum + Number(d.amount), 0)


  const collectorGroups: Record<string, CollectorGroup> = {}

  nonSelfDonations.forEach(d => {
    const collectorId = d.collected_by || 'direct_or_unknown'
    const collectorName = d.users?.full_name || 'Direct / Unknown'

    if (!collectorGroups[collectorId]) {
      collectorGroups[collectorId] = {
        id: collectorId,
        name: collectorName,
        donations: [],
        totalCash: 0,
        pendingCash: 0,
        totalUpi: 0,
        pendingUpi: 0
      }
    }

    collectorGroups[collectorId].donations.push(d)
    const amount = Number(d.amount)
    if (d.payment_mode === 'cash') {
      collectorGroups[collectorId].totalCash += amount
      if (d.status === 'pending') {
        collectorGroups[collectorId].pendingCash += amount
      }
    } else {
      collectorGroups[collectorId].totalUpi += amount
      if (d.status === 'pending') {
        collectorGroups[collectorId].pendingUpi += amount
      }
    }
  })

  const collectorList = Object.values(collectorGroups).sort((a, b) => a.name.localeCompare(b.name))

//new Line added by pratham
// Ranking: collectors sorted by total verified amount collected (cash + UPI), descending
  const rankingList = [...Object.values(collectorGroups)]
    .map(c => {
      const verifiedCash = c.donations
        .filter(d => d.status === 'verified' && d.payment_mode === 'cash')
        .reduce((sum, d) => sum + Number(d.amount), 0)
      const verifiedUpi = c.donations
        .filter(d => d.status === 'verified' && d.payment_mode !== 'cash')
        .reduce((sum, d) => sum + Number(d.amount), 0)
      const verifiedCount = c.donations.filter(d => d.status === 'verified').length
      return {
        ...c,
        totalCash: verifiedCash,
        totalUpi: verifiedUpi,
        totalAmount: verifiedCash + verifiedUpi,
        donationsCount: verifiedCount
      }
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)
  const topRankingAmount = rankingList.length > 0 ? rankingList[0].totalAmount : 0

  //line added by pratham  start line
  // Donor Ranking: group verified donations by donor phone, sorted by total donated descending
  interface DonorGroup {
    phone: string
    name: string
    totalAmount: number
    donationCount: number
  }

  const donorGroupsMap: Record<string, DonorGroup> = {}

  donations.filter(d => d.status === 'verified').forEach(d => {
    const key = d.donor_phone || d.donor_name || 'unknown'
    if (!donorGroupsMap[key]) {
      donorGroupsMap[key] = {
        phone: d.donor_phone,
        name: d.donor_name,
        totalAmount: 0,
        donationCount: 0
      }
    }
    donorGroupsMap[key].totalAmount += Number(d.amount)
    donorGroupsMap[key].donationCount += 1
  })

  const donorRankingList = Object.values(donorGroupsMap).sort((a, b) => b.totalAmount - a.totalAmount) //End

  const visibleCollectorList = collectorList.filter(c => c.pendingCash > 0 || c.pendingUpi > 0)
  const pendingSelfCount = selfDonations.filter(d => d.status === 'pending').length

  // Filter donations for the history tab
  const filteredHistoryDonations = donations.filter(d => {
    const query = historySearch.toLowerCase().trim()
    const matchesSearch = !query || 
      (d.donor_name && d.donor_name.toLowerCase().includes(query)) ||
      (d.donor_phone && d.donor_phone.toLowerCase().includes(query)) ||
      (d.receipt_number && d.receipt_number.toLowerCase().includes(query)) ||
      (d.amount && d.amount.toString().includes(query))

    let matchesCollector = true
    if (historyCollectorFilter === 'self') {
      matchesCollector = d.payment_mode === 'upi_self'
    } else if (historyCollectorFilter !== 'all') {
      matchesCollector = d.collected_by === historyCollectorFilter
    }

    let matchesType = true
    if (historyTypeFilter !== 'all') {
      matchesType = d.payment_mode === historyTypeFilter
    }

    return matchesSearch && matchesCollector && matchesType
  })

  // Get distinct list of collectors who have collections
  const distinctCollectors: { id: string; name: string }[] = []
  nonSelfDonations.forEach(d => {
    if (d.collected_by && d.users?.full_name) {
      if (!distinctCollectors.some(col => col.id === d.collected_by)) {
        distinctCollectors.push({ id: d.collected_by, name: d.users.full_name })
      }
    }
  })
  distinctCollectors.sort((a, b) => a.name.localeCompare(b.name))

  // Password complexity check states
  const passLength = tempPassword.length >= 8
  const passUpper = /[A-Z]/.test(tempPassword)
  const passLower = /[a-z]/.test(tempPassword)
  const passNumber = /[0-9]/.test(tempPassword)
  const passSpecial = /[^A-Za-z0-9]/.test(tempPassword)
  const isPasswordStrong = passLength && passUpper && passLower && passNumber && passSpecial

  // Available tabs depend on role
  const availableTabs: Tab[] = [
    'donations',
    'ranking',
    // history tab — blocked when subscription expired
    ...(!sub.isExpired ? ['history' as Tab] : []),
    // events tab — blocked when subscription expired
    ...(CAN.seeEventsTab(userRole) && !sub.isExpired ? ['events' as Tab] : []),
    // team tab — blocked when subscription expired
    ...(CAN.seeTeamTab(userRole) && !sub.isExpired ? ['team' as Tab] : []),
  ]

  // Handler called when admin dismisses the upgrade banner
  function handleBannerContinue() {
    setShowUpgradeBanner(false)
    // Execute the pending action they tried before the banner appeared
    if (pendingVerifyId) {
      const id = pendingVerifyId
      setPendingVerifyId(null)
      // Now actually run verify, bypassing the subscription check
      setVerifyingId(id)
      fetch('/api/donations/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donation_id: id, verified_by: userId, status: 'verified' })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          showToast('Donation verified', 'success')
          setDonations(prev => prev.map(d =>
            d.id === id ? { ...d, status: 'verified', pdf_url: data.pdf_url || d.pdf_url, rejection_reason: null } : d
          ))
          fetchDonations()
          setReviewingId(null)
          setScreenshotChecked(false)
        } else showToast(data.error || 'Could not verify', 'error')
        setVerifyingId(null)
      })
    }
    if (pendingBulkCollector) {
      const { id, mode } = pendingBulkCollector
      setPendingBulkCollector(null)
      if (!confirm(`Verify all pending ${mode === 'cash' ? 'Cash' : 'UPI'} for this collector?`)) return
      setBulkVerifyingCollector(id)
      setBulkVerifyingMode(mode)
      fetch('/api/donations/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collector_id: id, payment_mode: mode, verified_by: userId })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          showToast(`All pending ${mode === 'cash' ? 'Cash' : 'UPI'} verified`, 'success')
          fetchDonations()
        } else showToast(data.error || 'Could not verify', 'error')
        setBulkVerifyingCollector(null)
        setBulkVerifyingMode(null)
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-955 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-orange-500 border-r-transparent border-b-orange-500 border-l-transparent animate-spin" />
          <p className="text-gray-500 text-xs font-mono animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Mandatory Password Change Gate
  if (requiresPasswordChange) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
          
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-950/30 border border-orange-900/50 flex items-center justify-center text-orange-500 text-3xl">
            🔒
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white font-sans">Mandatory Password Change</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your account was created by the administrator. For security reasons, you must change your temporary password on first login.
            </p>
          </div>

          <form onSubmit={handleMandatoryPasswordChange} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">New Password</label>
              <input 
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars)"
                className="w-full bg-gray-955 border border-gray-855 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Confirm New Password</label>
              <input 
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-gray-955 border border-gray-855 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {changingPassword ? 'Updating Password...' : 'Update Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Intercept if organization account is suspended, or if KYC is not approved and verification is not bypassed
  if (mandalKyc && (mandalKyc.status === 'suspended' || (!BYPASS_KYC_VERIFICATION && (mandalKyc.kyc_status !== 'approved' || mandalKyc.status !== 'active')))) {
    if (mandalKyc.status === 'suspended') {
      return (
        <div className="min-h-screen bg-gray-955 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Red top border highlight */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-650" />

            {/* Error Shield Icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-red-955/30 border border-red-900/50 flex items-center justify-center text-red-500 text-3xl shadow-lg shadow-red-500/5">
              ⚠️
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Account Suspended</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                The organization account for <span className="font-semibold text-gray-250">{mandalKyc.name}</span> has been suspended by the administrator.
              </p>
            </div>

            <div className="p-4 bg-gray-955/40 rounded-xl border border-gray-850 text-left text-xs text-gray-300 space-y-1">
              <p className="font-bold text-[10px] text-red-400 uppercase tracking-wide">Next Steps</p>
              <p>For questions regarding suspension or to appeal for reactivation, please contact support.</p>
              <p className="text-gray-500 font-mono text-[9px] pt-1">Mandal ID: {mandalKyc.id}</p>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shadow-lg shadow-red-500/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      )
    }

    if (!BYPASS_KYC_VERIFICATION) {
      return (
        <KycVerificationPanel 
          mandal={mandalKyc} 
          userId={userId || ''}
          showToast={showToast} 
          onResubmitSuccess={initDashboard}
        />
      )
    }
  }

  const isKycDocsMissing = !BYPASS_KYC_VERIFICATION && !!(mandalKyc && (!mandalKyc.doc_admin_aadhaar || !mandalKyc.doc_bank_proof || !mandalKyc.doc_auth_letter || !mandalKyc.doc_address_proof))

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg text-sm font-medium shadow-xl
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Screenshot lightbox */}
      {activeScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActiveScreenshot(null)}
        >
          <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={activeScreenshot} alt="Payment screenshot" className="w-full rounded-xl" />
            <button
              onClick={() => setActiveScreenshot(null)}
              className="mt-3 w-full bg-gray-800 text-gray-300 py-2 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Upgrade banner interstitial */}
      {showUpgradeBanner && (
        <UpgradeBanner onContinue={handleBannerContinue} />
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Intellidon</p>
          <p className="text-sm sm:text-base font-semibold truncate max-w-[160px] sm:max-w-none">{mandalName}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full capitalize
            ${userRole === 'admin'
              ? 'bg-orange-900/50 text-orange-400'
              : 'bg-blue-900/50 text-blue-400'}`}>
            {userRole === 'admin' ? 'Adhyaksha' : 'Khajindar'}
          </span>
          <button
            onClick={() => router.push('/share')}
            className="text-[10px] sm:text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            🔗 <span className="hidden sm:inline">Share Link</span>
          </button>
          <button
            onClick={() => router.push('/dashboard/subscription')}
            className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap
              ${sub.isExpired
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : sub.daysRemaining <= 7
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
          >
            {sub.isExpired ? '⚠ Expired' : sub.daysRemaining <= 7 ? `⚠ ${sub.daysRemaining}d` : '📋 Plan'}
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-[10px] sm:text-xs text-red-400 hover:text-red-300 transition-colors whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>  

      {/* Subscription strip */}
      {!sub.loading && (
        <div
          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs
            ${sub.isExpired
              ? 'bg-red-950/60 border-b border-red-900/50'
              : sub.daysRemaining <= 7
                ? 'bg-yellow-950/60 border-b border-yellow-900/50'
                : 'bg-gray-900/60 border-b border-gray-800'}`}
        >
          <div className="flex items-center gap-2">
            <span className={`font-medium capitalize
              ${sub.isExpired ? 'text-red-400' : sub.daysRemaining <= 7 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {sub.isExpired
                ? '⚠ Subscription expired — history, events, and team management are locked'
                : sub.subscription
                  ? `${sub.subscription.plan.charAt(0).toUpperCase() + sub.subscription.plan.slice(1)} plan · ${sub.daysRemaining} days remaining`
                  : 'No active subscription'}
            </span>
          </div>
          <button
            onClick={() => router.push('/dashboard/subscription')}
            className={`flex-shrink-0 font-semibold px-3 py-1.5 rounded-lg transition-colors
              ${sub.isExpired
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : sub.daysRemaining <= 7
                  ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  : 'text-gray-400 hover:text-white'}`}
          >
            {sub.isExpired ? 'Upgrade now' : sub.daysRemaining <= 7 ? 'Renew' : 'View plan'}
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Role notice for manager */}
        {userRole === 'manager' && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-3 mb-5 text-xs text-blue-300">
            You are logged in as <strong>Khajindar (Manager)</strong>. You can view donations, verify cash, and view events. Team and event management is handled by the Adhyaksha.
          </div>
        )}

        {/* Summary cards */}
        {tab === 'donations' && summary && (
          <div className="flex flex-col gap-6 mb-6">
            {/* Unified Donations Summary */}
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-sm">📊</span>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Donations Summary
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Total verified donations', value: totalVerifiedCount },
                  { label: 'Self-donations (Verified)', value: formatAmount(selfVerifiedAmount) },
                  { label: 'Collected by Collectors (Verified)', value: formatAmount(collectorVerifiedAmount) },
                  { label: 'Total amount (Verified)', value: formatAmount(totalAmount) },
                  { label: 'Pending amount', value: formatAmount(totalPendingAmount) },
                ].map(card => (
                  <div key={card.label} className="bg-gray-800 rounded-xl p-4 flex flex-col h-full">
                    <p className="text-xs text-gray-400 mb-2">{card.label}</p>
                    <p className="text-xl font-semibold text-white mt-auto">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs — only show tabs the role has access to */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 mb-6 w-full sm:w-fit overflow-x-auto">
          {availableTabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0
                ${tab === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── TAB: Donations ── */}
        {tab === 'donations' && (
          <div className="flex flex-col gap-4">
            
            {/* Direct Self-Donation Drawer Toggle Button */}
            <div className="flex justify-between items-center bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Direct Self-Donations</h3>
                <p className="text-xs text-gray-400">Donations made directly by scanning the QR code</p>
              </div>
              <button
                onClick={() => setIsSelfDrawerOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
              >
                🌐 Verify Self-Donations
                {pendingSelfCount > 0 && (
                  <span className="bg-white text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingSelfCount}
                  </span>
                )}
              </button>
            </div>

            {donationsLoading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading donations...</p>
            ) : visibleCollectorList.length === 0 ? (
              <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
                <p className="text-gray-500 text-sm">No pending collector collections to verify.</p>
                <p className="text-gray-600 text-xs mt-1">All collections have been verified, or collectors have not entered new ones yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400 font-medium px-1 uppercase tracking-wider">Pending Verification by Collector</p>
                {visibleCollectorList.map(c => {
                  const isExpanded = expandedCollectors[c.id]
                  const hasPendingCash = c.pendingCash > 0
                  const hasPendingUpi = c.pendingUpi > 0

                  return (
                    <div 
                      key={c.id} 
                      className={`bg-gray-900 border rounded-xl overflow-hidden transition-all duration-200
                        ${isExpanded ? 'border-orange-500/50 shadow-lg' : 'border-gray-800'}`}
                    >
                      {/* Main Row clickable to toggle expansion */}
                      <div 
                        onClick={() => setExpandedCollectors(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-800/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-white">{c.name}</span>
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-medium">
                              {c.donations.filter(d => d.status === 'pending').length} pending collection{c.donations.filter(d => d.status === 'pending').length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {/* Cash & UPI breakdown */}
                          <div className="flex gap-4 mt-2 text-xs flex-wrap">
                            <div className="bg-gray-950/60 rounded-lg px-3 py-1.5 border border-gray-800/80">
                              <span className="text-gray-500 mr-1.5">Cash Pending:</span>
                              <span className="font-bold text-yellow-400">{formatAmount(c.pendingCash)}</span>
                            </div>
                            <div className="bg-gray-950/60 rounded-lg px-3 py-1.5 border border-gray-800/80">
                              <span className="text-gray-500 mr-1.5">UPI Pending:</span>
                              <span className="font-bold text-yellow-400">{formatAmount(c.pendingUpi)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons & Arrow */}
                        <div className="flex items-center gap-2 flex-wrap justify-end self-end md:self-auto" onClick={e => e.stopPropagation()}>
                          {hasPendingCash && !hasPendingUpi && CAN.verifyDonation(userRole) && (
                            <button
                              onClick={() => verifyCollectorBulk(c.id, 'cash')}
                              disabled={bulkVerifyingCollector === c.id}
                              className="bg-green-650 hover:bg-green-700 text-white font-medium text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {bulkVerifyingCollector === c.id && bulkVerifyingMode === 'cash' ? '...' : '✓ Verify Cash'}
                            </button>
                          )}

                          {!hasPendingCash && hasPendingUpi && CAN.verifyDonation(userRole) && (
                            <button
                              onClick={() => verifyCollectorBulk(c.id, 'upi_collector')}
                              disabled={bulkVerifyingCollector === c.id}
                              className="bg-green-650 hover:bg-green-700 text-white font-medium text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {bulkVerifyingCollector === c.id && bulkVerifyingMode === 'upi_collector' ? '...' : '✓ Verify UPI'}
                            </button>
                          )}

                          {hasPendingCash && hasPendingUpi && CAN.verifyDonation(userRole) && (
                            <button
                              onClick={() => setBulkVerifyModalCollector(c)}
                              className="bg-green-650 hover:bg-green-700 text-white font-medium text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              ✓ Verify
                            </button>
                          )}

                          <button 
                            onClick={() => setExpandedCollectors(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="text-gray-400 hover:text-white p-1 ml-1 cursor-pointer"
                          >
                            <svg 
                              className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Collections Table */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 bg-gray-950/20 p-4">
                          <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                            Individual Collections List
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-gray-800 text-gray-500 font-medium pb-2 block md:table-row">
                                  <th className="py-2 md:table-cell">Donor</th>
                                  <th className="py-2 md:table-cell">Phone</th>
                                  <th className="py-2 md:table-cell">Amount</th>
                                  <th className="py-2 md:table-cell">Mode</th>
                                  <th className="py-2 md:table-cell">Status</th>
                                  <th className="py-2 md:table-cell text-right">Receipt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/40">
                                {c.donations.map(d => (
                                  <tr key={d.id} className="hover:bg-gray-800/10">
                                    <td className="py-3 font-medium text-white">{d.donor_name}</td>
                                    <td className="py-3 text-gray-400">{d.donor_phone}</td>
                                    <td className="py-3 font-semibold text-white">{formatAmount(d.amount)}</td>
                                    <td className="py-3 text-gray-400 capitalize">
                                      {d.payment_mode === 'cash' ? '💵 Cash' : '📱 UPI'}
                                    </td>
                                    <td className="py-3">
                                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide
                                        ${d.status === 'verified' ? 'bg-green-950 text-green-400 border border-green-900/20' 
                                        : d.status === 'rejected' ? 'bg-red-950 text-red-400 border border-red-900/20'
                                        : 'bg-yellow-950 text-yellow-400 border border-yellow-900/20'}`}>
                                        {d.status}
                                      </span>
                                    </td>
                                    <td className="py-3 text-right">
                                      {d.pdf_url && d.status === 'verified' ? (
                                        <a
                                          href={d.pdf_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-block bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-2 py-1 rounded transition-colors text-[10px]"
                                        >
                                          ↓ Receipt
                                        </a>
                                      ) : (
                                        <span className="text-gray-600">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      
        {/* ── TAB: Ranking (Collectors + Donors) ── */}
        {tab === 'ranking' && (
          <div className="flex flex-col gap-4">

            {/* Sub-tab toggle */}
            <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 w-full sm:w-fit">
              {(['collectors', 'donors'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setRankingSubTab(st)}
                  className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap
                    ${rankingSubTab === st ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {st === 'collectors' ? '👥 Collectors' : '🎗️ Donors'}
                </button>
              ))}
            </div>

            {/* ── Collector Ranking ── */}
            {rankingSubTab === 'collectors' && (
              donationsLoading ? (
                <p className="text-gray-400 text-sm text-center py-12">Loading ranking...</p>
              ) : rankingList.length === 0 ? (
                <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
                  <p className="text-gray-500 text-sm">No collector activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-gray-400 font-medium px-1 uppercase tracking-wider">
                    Leaderboard — by total amount collected
                  </p>
                  {rankingList.map((c, index) => {
                    const rank = index + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                    return (
                      <div
                        key={c.id}
                        className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4
                          ${rank === 1 ? 'border-yellow-500/40 shadow-lg' : 'border-gray-800'}`}
                      >
                        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold
                          ${rank <= 3 ? 'bg-gray-800' : 'bg-gray-800 text-gray-400'}`}>
                          {medal ? <span className="text-xl">{medal}</span> : <span>#{rank}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-white truncate">{c.name}</span>
                            <span className="text-sm font-bold text-white flex-shrink-0">{formatAmount(c.totalAmount)}</span>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[11px] text-gray-500">
                            <span>💵 Cash: {formatAmount(c.totalCash)}</span>
                            <span>📱 UPI: {formatAmount(c.totalUpi)}</span>
                            <span>{c.donationsCount} donation{c.donationsCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── Donor Ranking ── */}
            {rankingSubTab === 'donors' && (
              donationsLoading ? (
                <p className="text-gray-400 text-sm text-center py-12">Loading ranking...</p>
              ) : donorRankingList.length === 0 ? (
                <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
                  <p className="text-gray-500 text-sm">No donor activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-gray-400 font-medium px-1 uppercase tracking-wider">
                    Top Donors — by total amount donated
                  </p>
                  {donorRankingList.map((d, index) => {
                    const rank = index + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                    return (
                      <div
                        key={d.phone + index}
                        className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4
                          ${rank === 1 ? 'border-yellow-500/40 shadow-lg' : 'border-gray-800'}`}
                      >
                        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold
                          ${rank <= 3 ? 'bg-gray-800' : 'bg-gray-800 text-gray-400'}`}>
                          {medal ? <span className="text-xl">{medal}</span> : <span>#{rank}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-white truncate">{d.name}</span>
                            <span className="text-sm font-bold text-white flex-shrink-0">{formatAmount(d.totalAmount)}</span>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[11px] text-gray-500">
                            <span>{d.phone}</span>
                            <span>{d.donationCount} donation{d.donationCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

          </div>
        )}


        {/* ── TAB: Collection History ── */}
        {tab === 'history' && (
          <div className="flex flex-col gap-4">
            
            {/* Search and Filters Bar */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center">
              
              {/* Search input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by donor name, phone, amount, or receipt..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <span className="absolute left-3 top-2 text-gray-500 text-xs">
                  🔍
                </span>
              </div>

              {/* Filters (Collector & Type) */}
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                
                {/* Collector filter dropdown */}
                <select
                  value={historyCollectorFilter}
                  onChange={e => setHistoryCollectorFilter(e.target.value)}
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="all" className="bg-gray-900 text-white">All Collectors</option>
                  <option value="self" className="bg-gray-900 text-white">Self-Donations (Online)</option>
                  {distinctCollectors.map(c => (
                    <option key={c.id} value={c.id} className="bg-gray-900 text-white">{c.name}</option>
                  ))}
                </select>

                {/* Donation Type filter dropdown */}
                <select
                  value={historyTypeFilter}
                  onChange={e => setHistoryTypeFilter(e.target.value)}
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="all" className="bg-gray-900 text-white">All Modes</option>
                  <option value="cash" className="bg-gray-900 text-white">💵 Cash</option>
                  <option value="upi_collector" className="bg-gray-900 text-white">📱 UPI (collector)</option>
                  <option value="upi_self" className="bg-gray-900 text-white">📱 UPI (self)</option>
                </select>

              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExportCSV(filteredHistoryDonations, `mandal_history_${new Date().toISOString().slice(0, 10)}.csv`)}
                disabled={filteredHistoryDonations.length === 0}
                className="flex-1 sm:flex-initial sm:px-6 py-2 bg-gray-900 border border-gray-800 text-gray-300 font-semibold rounded-lg text-xs hover:bg-gray-850 hover:text-white transition-colors disabled:opacity-50"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => handleExportPDF(filteredHistoryDonations, 'Mandal Collection History Report')}
                disabled={filteredHistoryDonations.length === 0}
                className="flex-1 sm:flex-initial sm:px-6 py-2 bg-gray-900 border border-gray-800 text-gray-300 font-semibold rounded-lg text-xs hover:bg-gray-850 hover:text-white transition-colors disabled:opacity-50"
              >
                📄 Export PDF
              </button>
            </div>

            {/* Donations Table/List */}
            {donationsLoading ? (
              <p className="text-gray-400 text-sm text-center py-12">Loading history...</p>
            ) : filteredHistoryDonations.length === 0 ? (
              <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
                <p className="text-gray-500 text-sm">No donations match your filters.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-500 font-medium">
                        <th className="p-3">Receipt No</th>
                        <th className="p-3">Donor</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Collector</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {filteredHistoryDonations.map(d => (
                        <tr key={d.id} className="hover:bg-gray-800/10 transition-colors">
                          <td className="p-3 font-mono text-gray-400 font-semibold">{d.receipt_number}</td>
                          <td className="p-3 font-medium text-white">{d.donor_name}</td>
                          <td className="p-3 text-gray-400">{d.donor_phone}</td>
                          <td className="p-3 font-bold text-white">{formatAmount(d.amount)}</td>
                          <td className="p-3 text-gray-300">
                            {d.payment_mode === 'upi_self' ? '🌐 Self' : (d.users?.full_name || 'Unknown')}
                          </td>
                          <td className="p-3 text-gray-400">
                            {d.payment_mode === 'cash' ? '💵 Cash' 
                            : d.payment_mode === 'upi_collector' ? '📱 UPI (C)' 
                            : '📱 UPI (S)'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide
                              ${d.status === 'verified' ? 'bg-green-950 text-green-400 border border-green-900/20' 
                              : d.status === 'rejected' ? 'bg-red-950 text-red-400 border border-red-900/20'
                              : 'bg-yellow-950 text-yellow-400 border border-yellow-900/20'}`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {d.pdf_url && d.status === 'verified' ? (
                              <a
                                href={d.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-2 py-1 rounded transition-colors text-[10px]"
                              >
                                ↓ Receipt
                              </a>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Events (admin + manager can VIEW, only admin can edit) ── */}
        {tab === 'events' && CAN.seeEventsTab(userRole) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{events.length} event{events.length !== 1 ? 's' : ''}</p>
              {CAN.createEvent(userRole) && (
                <button
                  onClick={() => {
                    if (showEventForm) {
                      cancelEventForm()
                    } else {
                      setShowEventForm(true)
                    }
                  }}
                  className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
                >
                  {showEventForm ? 'Close Form' : '+ New Event'}
                </button>
              )}
            </div>

            {showEventForm && CAN.createEvent(userRole) && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium">
                  {editingEventId ? 'Edit Event' : 'Create New Event'}
                </p>

                {/* Event name */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Event Name *</label>
                  <input
                    value={eventName}
                    onChange={e => setEventName(e.target.value)}
                    placeholder="e.g. Ganeshotsav"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Year</label>
                  <input
                    value={eventYear}
                    disabled
                    type="number"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>

                {/* UPI ID — required */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">UPI ID *</label>
                  <input
                    value={eventUpiId}
                    onChange={e => setEventUpiId(e.target.value)}
                    placeholder="e.g. mandal@okaxis"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">This is used to generate the UPI QR code for donations</p>
                </div>

                {/* Date row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Date *</label>
                    <input
                      type="date"
                      value={eventStartDate}
                      onChange={e => { setEventStartDate(e.target.value); setDateError('') }}
                      min={
                        editingEventId && eventStartDate && eventStartDate < new Date().toISOString().split('T')[0]
                          ? eventStartDate
                          : new Date().toISOString().split('T')[0]
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">End Date *</label>
                    <input
                      type="date"
                      value={eventEndDate}
                      onChange={e => { setEventEndDate(e.target.value); setDateError('') }}
                      min={
                        editingEventId && eventEndDate && eventEndDate < (eventStartDate || new Date().toISOString().split('T')[0])
                          ? eventEndDate
                          : (eventStartDate || new Date().toISOString().split('T')[0])
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Duration preview */}
                {eventStartDate && eventEndDate && (() => {
                  const days = Math.round(
                    (new Date(eventEndDate).getTime() - new Date(eventStartDate).getTime())
                    / (1000 * 60 * 60 * 24)
                  )
                  return days > 0 ? (
                    <div className={`text-xs px-3 py-2 rounded-lg ${days > 50 ? 'bg-red-900/40 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                      Duration: <span className="font-medium">{days} days</span>
                      {days > 50 && ' — exceeds 50 day limit'}
                      {days <= 50 && ` of 50 day maximum`}
                    </div>
                  ) : null
                })()}

                {/* Date error */}
                {dateError && (
                  <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2">
                    <p className="text-red-400 text-xs">{dateError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={editingEventId ? updateEvent : createEvent}
                    disabled={eventSubmitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg"
                  >
                    {eventSubmitting ? 'Saving...' : editingEventId ? 'Save Changes' : 'Create Event'}
                  </button>
                  <button onClick={cancelEventForm} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {events.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                {CAN.createEvent(userRole) ? 'No events yet. Create one above.' : 'No events created yet. Ask the Adhyaksha to create an event.'}
              </p>
            ) : (
              events.map(ev => {
                const isExpired = ev.is_expired || ev.end_date < new Date().toISOString().split('T')[0]
                const isSuspended = ev.is_suspended
                return (
                  <div key={ev.id} className={`bg-gray-800 border rounded-xl p-4
                    ${isExpired || isSuspended ? 'border-gray-700 opacity-60' : 'border-gray-700'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-white text-sm">{ev.name} {ev.year}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {ev.upi_id ? `UPI: ${ev.upi_id}` : 'No UPI ID'}
                        </p>
                        <p className="text-xs text-gray-550 mt-1">
                          {new Date(ev.start_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          {' — '}
                          {new Date(ev.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                          {ev.days_remaining > 0 && !isExpired && !isSuspended && (
                            <span className="text-orange-400 ml-2">{ev.days_remaining} days left</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full
                          ${isSuspended
                            ? 'bg-red-900/50 text-red-400'
                            : isExpired
                              ? 'bg-gray-700 text-gray-500'
                              : ev.is_active
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-gray-700 text-gray-400'}`}>
                          {isSuspended ? 'Suspended by Intellidon Admin' : isExpired ? 'Expired' : ev.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {/* Toggle only available if not expired and not suspended */}
                        {!isExpired && !isSuspended && CAN.toggleEvent(userRole) && (
                          <button
                            onClick={() => toggleEvent(ev.id, ev.is_active)}
                            className="text-xs text-gray-455 hover:text-white transition-colors"
                          >
                            {ev.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {/* Edit only available if not expired and not suspended */}
                        {!isExpired && !isSuspended && CAN.createEvent(userRole) && (
                          <button
                            onClick={() => startEditingEvent(ev)}
                            className="text-xs text-orange-400 hover:text-orange-300 transition-colors ml-2"
                          >
                            Edit
                          </button>
                        )}
                        {isExpired && (
                          <span className="text-xs text-gray-600">Permanently off</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── TAB: Team (admin only) ── */}
        {tab === 'team' && CAN.seeTeamTab(userRole) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              <button
                onClick={() => setShowMemberForm(!showMemberForm)}
                className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
              >
                + Add Member
              </button>
            </div>

            {/* Role guide */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
              <p className="font-medium text-white text-sm mb-2">Role guide</p>
              <p><span className="text-orange-400 font-medium">Adhyaksha (Admin)</span> — full access. Manages team, events, and sees all data.</p>
              <p className="mt-1"><span className="text-blue-400 font-medium">Khajindar (Manager)</span> — can view donations and verify cash. Cannot manage team or events.</p>
              <p className="mt-1"><span className="text-gray-300 font-medium">Sevak (Collector)</span> — can only enter new donations from their phone. Cannot see reports.</p>
            </div>

            {/* Add member form */}
            {showMemberForm && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium">Add Team Member</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['collector', 'manager'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setMemberRole(r)}
                      className={`py-2 rounded-lg text-xs font-medium border capitalize transition-colors
                        ${memberRole === r ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400'}`}
                    >
                      {r === 'collector' ? 'Sevak' : 'Khajindar'}
                      <span className="block text-gray-500 font-normal capitalize">{r}</span>
                    </button>
                  ))}
                </div>
                <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Full name"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberPhone} onChange={e => setMemberPhone(e.target.value)} placeholder="Phone number" type="tel"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Email (used to login)" type="email"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={memberPassword} onChange={e => setMemberPassword(e.target.value)} placeholder="Password (min 8 characters)" type="password"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <div className="flex gap-2">
                  <button onClick={addMember} disabled={memberSubmitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg">
                    {memberSubmitting ? 'Adding...' : `Add ${memberRole === 'collector' ? 'Sevak' : 'Khajindar'}`}
                  </button>
                  <button onClick={() => setShowMemberForm(false)} className="px-4 bg-gray-700 text-gray-300 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No team members yet.</p>
            ) : (
              members.map(m => (
                <div key={m.id} className={`bg-gray-800 border rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 transition-colors ${
                  m.is_active === false ? 'border-gray-800 bg-gray-900/40 opacity-75' : 'border-gray-700'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${m.is_active === false ? 'text-gray-500 line-through' : 'text-white'}`}>{m.full_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${m.role === 'admin' ? 'bg-orange-900/50 text-orange-400'
                        : m.role === 'manager' ? 'bg-blue-900/50 text-blue-400'
                        : m.role === 'super_admin' ? 'bg-purple-900/50 text-purple-400'
                        : 'bg-gray-700 text-gray-300'}`}>
                        {m.role === 'admin' ? 'Adhyaksha'
                        : m.role === 'manager' ? 'Khajindar'
                        : m.role === 'collector' ? 'Sevak'
                        : m.role}
                      </span>
                      {m.is_active === false && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-900/60 text-gray-400 border border-gray-800">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{m.phone}</p>
                  </div>
                  {/* Cannot edit/remove/reset yourself, another admin, or super_admin */}
                  {m.id !== userId && !['admin', 'super_admin'].includes(m.role) ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openEditModal(m)}
                        className="text-xs bg-gray-700/60 hover:bg-gray-700 text-gray-200 px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openResetPasswordModal(m)}
                        className="text-xs bg-orange-600/80 hover:bg-orange-600 text-white px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => toggleMemberStatus(m)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer ${
                          m.is_active === false
                            ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white'
                            : 'bg-red-950/60 hover:bg-red-900/65 text-red-200 border border-red-900/30'
                        }`}
                      >
                        {m.is_active === false ? 'Activate' : 'Deactivate'}
                      </button>
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-xs text-red-400/60 hover:text-red-400 transition-colors font-medium ml-1 cursor-pointer"
                        title="Delete Permanently"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {/* Drawer Backdrop */}
        {isSelfDrawerOpen && (
          <div 
            className="fixed inset-0 z-35 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => {
              setIsSelfDrawerOpen(false)
              setReviewingId(null)
              setScreenshotChecked(false)
            }}
          />
        )}

        {/* ── Self Donation Verification Drawer (Sliding Panel) ── */}
        <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-md bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transition-transform duration-305 ease-in-out transform
          ${isSelfDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 backdrop-blur">
            <div>
              <h3 className="font-semibold text-white">Self-Donations Verification</h3>
              <p className="text-xs text-gray-400">Direct online payment uploads</p>
            </div>
            <button 
              onClick={() => {
                setIsSelfDrawerOpen(false)
                setReviewingId(null)
                setScreenshotChecked(false)
              }}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selfDonations.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-12">No self-donations recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {selfDonations.map(d => {
                  const isReviewing = reviewingId === d.id
                  return (
                    <div 
                      key={d.id} 
                      className={`bg-gray-850 border rounded-xl overflow-hidden transition-all
                        ${isReviewing ? 'border-orange-500 bg-gray-900' : 'border-gray-800'}
                        ${d.status === 'rejected' ? 'border-red-900/30 bg-red-950/5' : ''}`}
                    >
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-white text-sm">{d.donor_name}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide
                              ${d.status === 'verified' ? 'bg-green-950 text-green-400 border border-green-900/20'
                              : d.status === 'rejected' ? 'bg-red-950 text-red-400 border border-red-900/20'
                              : 'bg-yellow-950 text-yellow-400 border border-yellow-900/20'}`}>
                              {d.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {d.donor_phone}{d.donor_address ? ` · ${d.donor_address}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(d.created_at)}
                          </p>
                          {d.status === 'rejected' && d.rejection_reason && (
                            <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/20 rounded px-2 py-1 mt-2">
                              Reason: {d.rejection_reason}
                            </p>
                          )}
                          <p className="text-xs font-mono text-gray-600 mt-1">{d.receipt_number}</p>
                        </div>

                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                          <p className="text-lg font-bold text-white">{formatAmount(d.amount)}</p>
                          
                          {d.status === 'pending' && CAN.verifyDonation(userRole) && !isReviewing && (
                            <button
                              onClick={() => {
                                setReviewingId(d.id)
                                setScreenshotChecked(false)
                              }}
                              className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Review
                            </button>
                          )}

                          {d.pdf_url && d.status === 'verified' && (
                            <a
                              href={d.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors"
                            >
                              ↓ Receipt
                            </a>
                          )}
                        </div>
                      </div>

                      {isReviewing && (
                        <div className="border-t border-orange-500/20 bg-gray-950/50 p-4 flex flex-col gap-4">
                          {d.screenshot_url ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-medium text-gray-300">Payment Screenshot</p>
                              <img
                                src={d.screenshot_url}
                                alt="Payment screenshot"
                                className="w-full max-w-xs rounded-xl border border-gray-850 object-contain cursor-pointer"
                                onClick={() => setActiveScreenshot(d.screenshot_url)}
                              />
                              <a
                                href={d.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Open full size ↗
                              </a>
                            </div>
                          ) : (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                              <p className="text-gray-500 text-xs">No screenshot uploaded</p>
                            </div>
                          )}

                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                checked={screenshotChecked}
                                onChange={e => setScreenshotChecked(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                ${screenshotChecked ? 'bg-green-600 border-green-600' : 'border-gray-500 bg-gray-900 group-hover:border-gray-400'}`}>
                                {screenshotChecked && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-300 leading-relaxed">
                              I confirm receipt of <span className="text-white font-semibold">{formatAmount(d.amount)}</span> from {d.donor_name}.
                            </span>
                          </label>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setRejectionModalId(d.id)}
                              className="flex-1 bg-red-900/40 hover:bg-red-900/60 text-red-350 border border-red-900/30 font-medium py-2 rounded-lg text-xs transition-colors"
                            >
                              ✗ Reject
                            </button>
                            {screenshotChecked && (
                              <button
                                onClick={() => verifyDonation(d.id)}
                                disabled={verifyingId === d.id}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg text-xs disabled:opacity-50 transition-colors"
                              >
                                {verifyingId === d.id ? 'Approving...' : '✓ Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Rejection Reason Modal Popup ── */}
        {rejectionModalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Reject Self-Donation</h3>
              <p className="text-xs text-gray-400 mb-3">Provide a reason for rejection (visible to the mandal audit):</p>
              
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Screenshot mismatch, payment not received, duplicate entry..."
                rows={3}
                className="w-full bg-gray-950 border border-gray-805 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500 mb-4 resize-none"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setRejectionModalId(null)
                    setRejectionReason('')
                  }}
                  disabled={submittingRejection}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!rejectionReason.trim()) {
                      showToast('Rejection reason is required', 'error')
                      return
                    }
                    rejectDonation(rejectionModalId, rejectionReason.trim())
                  }}
                  disabled={submittingRejection || !rejectionReason.trim()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {submittingRejection ? 'Rejecting...' : 'Reject Donation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Reset Password Modal Popup ── */}
        {resetPasswordUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-4">Reset Password</h3>
              
              <div className="mb-4 space-y-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">User:</label>
                  <p className="text-sm font-medium text-white">{resetPasswordUser.full_name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Role:</label>
                  <p className="text-xs font-medium text-gray-300 capitalize">
                    {resetPasswordUser.role === 'manager' ? 'Khajindar (Manager)' : resetPasswordUser.role === 'collector' ? 'Sevak (Collector)' : resetPasswordUser.role}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">New Temporary Password:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                    placeholder="Enter password (min 8 chars)"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-colors border border-gray-700 cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
                <div className="mt-3 space-y-1 bg-gray-950/45 border border-gray-800/80 rounded-lg p-2.5">
                  <p className="text-[9px] text-gray-500 font-bold mb-1.5 uppercase tracking-wider">Password Requirements:</p>
                  
                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passLength ? 'text-emerald-400 font-medium' : 'text-red-400') : 'text-gray-500'}>
                      {tempPassword ? (passLength ? '✓' : '✗') : '•'} At least 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passUpper ? 'text-emerald-400 font-medium' : 'text-red-400') : 'text-gray-500'}>
                      {tempPassword ? (passUpper ? '✓' : '✗') : '•'} Uppercase letter (A-Z)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passLower ? 'text-emerald-400 font-medium' : 'text-red-400') : 'text-gray-500'}>
                      {tempPassword ? (passLower ? '✓' : '✗') : '•'} Lowercase letter (a-z)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passNumber ? 'text-emerald-400 font-medium' : 'text-red-400') : 'text-gray-500'}>
                      {tempPassword ? (passNumber ? '✓' : '✗') : '•'} A number (0-9)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passSpecial ? 'text-emerald-400 font-medium' : 'text-red-400') : 'text-gray-500'}>
                      {tempPassword ? (passSpecial ? '✓' : '✗') : '•'} Special character (e.g. #, @, $, !, %, &, *)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordUser(null)
                    setTempPassword('')
                  }}
                  disabled={resetPasswordSubmitting}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={resetPasswordSubmitting || !isPasswordStrong}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {resetPasswordSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Password Updated Modal Popup ── */}
        {showPasswordUpdatedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-center">
              <div className="w-12 h-12 bg-green-900/30 text-green-400 border border-green-800/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Password Updated</h3>
              <p className="text-xs text-gray-400 mb-4">Please share this password securely with the team member.</p>
              
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 mb-5 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-orange-400 select-all tracking-wider">{generatedPassword}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword)
                    showToast('Password copied to clipboard', 'success')
                  }}
                  className="text-xs text-orange-500 hover:text-orange-400 font-semibold cursor-pointer"
                >
                  Copy Button
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordUpdatedModal(false)
                  setGeneratedPassword('')
                }}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Edit Member Modal Popup ── */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-4">Edit Team Member</h3>
              
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['collector', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditRole(r)}
                        className={`py-2 rounded-lg text-xs font-semibold border capitalize transition-colors cursor-pointer
                          ${editRole === r ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'}`}
                      >
                        {r === 'collector' ? 'Sevak (Collector)' : 'Khajindar (Manager)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-gray-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={updateMember}
                  disabled={editSubmitting || !editName.trim() || !editPhone.trim()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Verification Modal for Both Cash & UPI Pending */}
        {bulkVerifyModalCollector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Verify Collections</h3>
              <p className="text-xs text-gray-400 mb-4">
                Select which pending collections to verify for <strong>{bulkVerifyModalCollector.name}</strong>:
              </p>

              <div className="space-y-3 mb-5">
                {/* Cash Info & Verify Button */}
                {bulkVerifyModalCollector.pendingCash > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-950/60 rounded-xl border border-gray-800">
                    <div>
                      <p className="text-xs font-medium text-gray-400">Cash Pending</p>
                      <p className="text-lg font-bold text-yellow-400">{formatAmount(bulkVerifyModalCollector.pendingCash)}</p>
                    </div>
                    <button
                      onClick={() => verifyCollectorBulk(bulkVerifyModalCollector.id, 'cash')}
                      className="bg-green-650 hover:bg-green-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      ✓ Verify Cash
                    </button>
                  </div>
                )}

                {/* UPI Info & Verify Button */}
                {bulkVerifyModalCollector.pendingUpi > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-950/60 rounded-xl border border-gray-800">
                    <div>
                      <p className="text-xs font-medium text-gray-400">UPI Pending</p>
                      <p className="text-lg font-bold text-yellow-400">{formatAmount(bulkVerifyModalCollector.pendingUpi)}</p>
                    </div>
                    <button
                      onClick={() => verifyCollectorBulk(bulkVerifyModalCollector.id, 'upi_collector')}
                      className="bg-green-650 hover:bg-green-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      ✓ Verify UPI
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setBulkVerifyModalCollector(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors w-full sm:w-auto cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}