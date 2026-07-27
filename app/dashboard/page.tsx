'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { isSubscriptionExpired } from '@/lib/subscription'
import { useSubscription } from '@/lib/useSubscription'
import UpgradeBanner from '@/components/UpgradeBanner'
import KycVerificationPanel from '@/components/dashboard/KycVerificationPanel'
import SponsorshipSection from '@/components/dashboard/SponsorshipSection'
import ExpenseManagerPanel from '@/components/dashboard/ExpenseManagerPanel'
import ThemeToggle from '@/components/ThemeToggle'
import { downloadReceipt, shareReceipt, type ReceiptData } from '@/lib/downloadReceipt'

// ── TESTING / MIGRATION CONFIGURATION ──────────────────────────
// Set to true to bypass KYC blocks and mandatory document upload popups (for testing / old accounts migration).
// Toggle to false for production compliance enforcement.
const BYPASS_KYC_VERIFICATION = false

// ── Types ──────────────────────────────────────────────────────
type Tab = 'donations' | 'ranking' | 'history' | 'events' | 'team'

type Donation = {
  id: string
  event_id: string
  receipt_number: string
  donor_name: string
  donor_phone: string
  donor_address: string | null
  amount: number
  payment_mode: string
  status: string
  screenshot_url: string | null
  created_at: string
  users: { full_name: string; role?: string } | null
  receipt_data: ReceiptData | null
  collected_by: string | null
  rejection_reason: string | null
  settlement_id: string | null
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
  email?: string
  role: string
  is_active: boolean
  event_ids?: string[]   // empty/undefined = access to ALL events
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
  verifyDonation: (role: string) => ['admin', 'manager'].includes(role),
  createEvent: (role: string) => role === 'admin',
  toggleEvent: (role: string) => role === 'admin',
  addMember: (role: string) => role === 'admin',
  removeMember: (role: string) => role === 'admin',
  seeTeamTab: (role: string) => role === 'admin',   // manager cannot manage team
  seeEventsTab: (role: string) => ['admin', 'manager'].includes(role),
  manageExpenses: (role: string) => ['admin', 'manager'].includes(role),  // Adhyaksha + Khajindar (#11)
}

export default function DashboardPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [mandalId, setMandalId] = useState<string | null>(null)
  const [mandalName, setMandalName] = useState('')
  const [mandalKyc, setMandalKyc] = useState<any>(null)

  // Theme State (Syncs with Landing / Login / Register light/dark theme)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('intellidon-theme') as 'light' | 'dark' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.classList.toggle('dark', saved === 'dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('intellidon-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const isDark = theme === 'dark'

  // Default tab — manager only sees donations, admin sees all
  const [tab, setTab] = useState<Tab>('donations')
  const [expenseManagerEvent, setExpenseManagerEvent] = useState<Event | null>(null)
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
  const [historyEventFilter, setHistoryEventFilter] = useState('all')
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false)
  const [historyRecordType, setHistoryRecordType] = useState<'donations' | 'sponsors'>('donations')
  const [historySponsorEventFilter, setHistorySponsorEventFilter] = useState('all')
  // Donations Summary — event scope selector (all events, or one specific event)
  const [summaryEventFilter, setSummaryEventFilter] = useState('all')
  // Ranking tab — event scope selector shared across collectors/donors/sponsors sub-tabs
  const [rankingEventFilter, setRankingEventFilter] = useState('all')
  //line added by pratham:
  const [rankingSubTab, setRankingSubTab] = useState<'collectors' | 'donors' | 'sponsors'>('collectors')
  const [sponsorRankingList, setSponsorRankingList] = useState<Array<{
    id: string; event_id: string; company_name: string; sponsor_type: string | null; package: string | null
    contact_person_name: string | null; contact_person_phone: string | null; email: string | null
    committed_amount: number; amount_received: number; amount_pending: number; payment_status: string
    payment_method: string | null; transaction_id: string | null; contribution_date: string | null
    estimated_value: number | null; quantity: number | null; goods_service_description: string | null
    notes: string | null
  }>>([])
  const [sponsorRankingLoading, setSponsorRankingLoading] = useState(false)
  const [donationSubTab, setDonationSubTab] = useState<'support_fund' | 'sponsorship'>('support_fund')
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

  // Sponsor CSV export (History tab)
  type SponsorHistoryRow = typeof sponsorRankingList[number]
  const handleExportSponsorCSV = (sponsorsToExport: SponsorHistoryRow[], filename = 'sponsor_history.csv') => {
    const eventName = (eventId: string) => {
      const ev = events.find(e => e.id === eventId)
      return ev ? `${ev.name} ${ev.year}` : ''
    }
    const headers = [
      'Company Name', 'Sponsor Type', 'Package', 'Event', 'Contact Person', 'Phone', 'Email',
      'Committed Amount', 'Amount Received', 'Amount Pending', 'Payment Status',
      'Payment Method', 'Transaction ID', 'Contribution Date',
      'Goods/Service Name', 'Quantity', 'Estimated Value', 'Notes'
    ]
    const rows = sponsorsToExport.map(s => [
      s.company_name,
      s.sponsor_type === 'goods_service' ? 'Goods/Service' : 'Finance',
      s.package || '',
      eventName(s.event_id),
      s.contact_person_name || '',
      s.contact_person_phone || '',
      s.email || '',
      s.committed_amount,
      s.amount_received,
      s.amount_pending,
      s.payment_status,
      s.payment_method || '',
      s.transaction_id || '',
      s.contribution_date ? new Date(s.contribution_date).toLocaleDateString('en-IN') : '',
      s.goods_service_description || '',
      s.quantity ?? '',
      s.estimated_value ?? '',
      s.notes || ''
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

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Sponsor PDF export (History tab)
  const handleExportSponsorPDF = (sponsorsToExport: SponsorHistoryRow[], title = 'Sponsorship History Report') => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site to download the PDF report.')
      return
    }

    const eventName = (eventId: string) => {
      const ev = events.find(e => e.id === eventId)
      return ev ? `${ev.name} ${ev.year}` : '—'
    }

    const totalCommitted = sponsorsToExport.reduce((sum, s) => sum + Number(s.committed_amount || 0), 0)
    const totalReceived = sponsorsToExport.reduce((sum, s) => sum + Number(s.amount_received || 0), 0)
    const totalEstimatedGoods = sponsorsToExport
      .filter(s => s.sponsor_type === 'goods_service')
      .reduce((sum, s) => sum + Number(s.estimated_value || 0), 0)

    const tableRows = sponsorsToExport.map(s => `
      <tr>
        <td>${s.company_name}</td>
        <td class="capitalize">${s.sponsor_type === 'goods_service' ? 'Goods/Service' : 'Finance'}</td>
        <td>${s.package || '—'}</td>
        <td>${eventName(s.event_id)}</td>
        <td>${s.contact_person_name || '—'}${s.contact_person_phone ? ' · ' + s.contact_person_phone : ''}</td>
        <td>${s.sponsor_type === 'goods_service' ? `₹${Number(s.estimated_value || 0).toLocaleString('en-IN')} (est.)` : `₹${Number(s.committed_amount).toLocaleString('en-IN')}`}</td>
        <td>₹${Number(s.amount_received).toLocaleString('en-IN')}</td>
        <td class="status-${s.payment_status === 'completed' ? 'verified' : s.payment_status === 'pending' ? 'pending' : 'rejected'}">${s.payment_status.replace('_', ' ').toUpperCase()}</td>
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
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
            .summary-card { background: #f7fafc; border: 1px solid #edf2f7; padding: 12px; border-radius: 8px; }
            .summary-label { font-size: 10px; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
            .summary-value { font-size: 18px; font-weight: bold; margin-top: 4px; color: #1a202c; }
            table { width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; margin-top: 12px; }
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
              <div class="summary-label">Total Committed (Finance)</div>
              <div class="summary-value">₹${totalCommitted.toLocaleString('en-IN')}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Received</div>
              <div class="summary-value">₹${totalReceived.toLocaleString('en-IN')}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Est. Goods/Service Value</div>
              <div class="summary-value">₹${totalEstimatedGoods.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Type</th>
                <th>Package</th>
                <th>Event</th>
                <th>Contact</th>
                <th>Committed / Est. Value</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Generated via Intellidon Donation System.
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
  const [memberEventScope, setMemberEventScope] = useState<'all' | 'specific'>('all')
  const [memberEventIds, setMemberEventIds] = useState<string[]>([])

  // Edit / Reset Password states
  const [editUser, setEditUser] = useState<Member | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<'collector' | 'manager'>('collector')
  const [editEventScope, setEditEventScope] = useState<'all' | 'specific'>('all')
  const [editEventIds, setEditEventIds] = useState<string[]>([])
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
    if (tab === 'donations') { fetchDonations(); fetchEvents(); fetchSponsorRanking() }
    if (tab === 'events') fetchEvents()
    if (tab === 'team') { fetchTeam(); fetchEvents() }
    if (tab === 'ranking') { fetchDonations(); fetchSponsorRanking() }
    if (tab === 'history') { fetchDonations(); fetchEvents(); fetchSponsorRanking() }
  }, [tab, mandalId])

  // ── Donations ─────────────────────────────────────────────────
  async function fetchDonations() {
    setDonationsLoading(true)
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/donations?mandal_id=${mandalId}`, { headers })
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
    const headers = await getAuthHeaders()
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ donation_id: donationId, verified_by: userId, status: 'verified' })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Donation verified — receipt generated', 'success')
      setDonations(prev => prev.map(d =>
        d.id === donationId
          ? { ...d, status: 'verified', receipt_data: data.receipt_data || d.receipt_data, rejection_reason: null }
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
    const headers = await getAuthHeaders()
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers,
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

    const headers = await getAuthHeaders()
    const res = await fetch('/api/donations/verify', {
      method: 'PATCH',
      headers,
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

  async function settleCollector(collectorId: string, paymentMode?: 'cash' | 'upi') {
    if (!CAN.verifyDonation(userRole)) return
    if (sub.isExpired) {
      showToast('Subscription expired. Please renew plan.', 'error')
      return
    }

    const targetEventId = (summaryEventFilter && summaryEventFilter !== 'all')
      ? summaryEventFilter
      : undefined

    const modeLabel = paymentMode ? (paymentMode === 'cash' ? 'Cash' : 'UPI') : 'all'
    if (!confirm(`Are you sure you want to verify ${modeLabel} received and settle collections for this collector?`)) return

    setBulkVerifyModalCollector(null)
    setBulkVerifyingCollector(collectorId)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collector_id: collectorId,
          ...(targetEventId ? { event_id: targetEventId } : {}),
          verified_by: userId,
          payment_mode: paymentMode,
          notes: `Settled from admin dashboard: ${modeLabel} only`
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Collector ${modeLabel} collections settled successfully!`, 'success')
        fetchDonations()
      } else {
        showToast(data.error || 'Could not settle collections', 'error')
      }
    } catch (err) {
      showToast('Failed to connect to server', 'error')
    } finally {
      setBulkVerifyingCollector(null)
    }
  }


  // ── Events ────────────────────────────────────────────────────
  async function fetchEvents() {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/events?mandal_id=${mandalId}`, { headers })
    const data = await res.json()
    if (!data.error) setEvents(data.events)
  }

  // Mandal-wide sponsor list for the Ranking tab's Sponsors leaderboard
  // and the History tab's Sponsors export/filter view.
  async function fetchSponsorRanking() {
    if (!mandalId) return
    setSponsorRankingLoading(true)
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/sponsors?mandal_id=${mandalId}`, { headers })
    const data = await res.json()
    if (!data.error) setSponsorRankingList(data.sponsors)
    setSponsorRankingLoading(false)
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
    const today = new Date(); today.setHours(0, 0, 0, 0)

    if (end <= start) { setDateError('End date must be after start date'); return }

    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 50) { setDateError(`Duration is ${days} days — maximum is 50 days`); return }
    if (start < today) { setDateError('Start date cannot be in the past'); return }

    setEventSubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/events', {
      method: 'POST',
      headers,
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
    const headers = await getAuthHeaders()
    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers,
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
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (originalEvent && eventStartDate !== originalEvent.start_date && start < today) {
      setDateError('Start date cannot be in the past')
      return
    }

    setEventSubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/events', {
      method: 'PUT',
      headers,
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
    const cleanPhone = memberPhone.replace(/[^0-9]/g, "")
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit phone number', 'error')
      return
    }
    const hasLength = memberPassword.length >= 8
    const hasUpper = /[A-Z]/.test(memberPassword)
    const hasLower = /[a-z]/.test(memberPassword)
    const hasNumber = /[0-9]/.test(memberPassword)
    const hasSpecial = /[^A-Za-z0-9]/.test(memberPassword)

    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      showToast('Password does not meet complexity requirements', 'error')
      return
    }
    if (memberEventScope === 'specific' && memberEventIds.length === 0) {
      showToast('Select at least one event, or switch to "All events"', 'error'); return
    }
    setMemberSubmitting(true)
    const headers = await getAuthHeaders()
    const res = await fetch('/api/team', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mandal_id: mandalId,
        full_name: memberName,
        phone: memberPhone,
        email: memberEmail,
        password: memberPassword,
        role: memberRole,
        event_ids: memberEventScope === 'specific' ? memberEventIds : []
      })
    })
    const data = await res.json()
    if (data.success) {
      showToast(data.warning || 'Member added', data.warning ? 'error' : 'success')
      setMembers(prev => [...prev, data.member])
      setMemberName(''); setMemberPhone(''); setMemberEmail(''); setMemberPassword('')
      setMemberEventScope('all'); setMemberEventIds([])
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
    const ids = member.event_ids || []
    setEditEventScope(ids.length > 0 ? 'specific' : 'all')
    setEditEventIds(ids)
  }

  async function updateMember() {
    if (!editUser) return
    if (!editName || !editPhone || !editRole) {
      showToast('All fields required', 'error'); return
    }
    const cleanPhone = editPhone.replace(/[^0-9]/g, "")
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit phone number', 'error')
      return
    }
    if (editEventScope === 'specific' && editEventIds.length === 0) {
      showToast('Select at least one event, or switch to "All events"', 'error'); return
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
          role: editRole,
          event_ids: editEventScope === 'specific' ? editEventIds : []
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
  // NOTE: previously this section scoped everything to a single "active"
  // event (events.find(e => e.is_active)), which meant donations belonging
  // to any other event (past events, or events not currently flagged
  // active) silently disappeared from Support Fund, Verify Self-Donations,
  // and the Ranking tab. Support Fund / self-donation verification now
  // always looks across ALL events, while the Donations Summary and
  // Ranking tab are scoped by their own event-picker (defaulting to "All
  // Events") so nothing is hidden by default and users can still drill
  // into a single event.
  function filterDonationsByEvent(list: Donation[], eventFilter: string) {
    return eventFilter === 'all' ? list : list.filter(d => d.event_id === eventFilter)
  }

  function groupByCollector(list: Donation[]) {
    const groups: Record<string, CollectorGroup> = {}
    list.forEach(d => {
      const collectorId = d.collected_by || 'direct_or_unknown'
      const collectorName = d.users?.full_name || 'Direct / Unknown'

      if (!groups[collectorId]) {
        groups[collectorId] = {
          id: collectorId,
          name: collectorName,
          donations: [],
          totalCash: 0,
          pendingCash: 0,
          totalUpi: 0,
          pendingUpi: 0
        }
      }

      groups[collectorId].donations.push(d)
      const amount = Number(d.amount)
      if (d.payment_mode === 'cash') {
        groups[collectorId].totalCash += amount
        // Support Fund: transactions with payment status "verified" or "pending" AND
        // not yet settled count towards the unsettled Cash amount.
        if ((d.status === 'verified' || d.status === 'pending') && !d.settlement_id) {
          groups[collectorId].pendingCash += amount
        }
      } else {
        groups[collectorId].totalUpi += amount
        // Support Fund: transactions with payment status "verified" or "pending" AND
        // not yet settled count towards the unsettled UPI amount.
        if ((d.status === 'verified' || d.status === 'pending') && d.payment_mode === 'upi_collector' && !d.settlement_id) {
          groups[collectorId].pendingUpi += amount
        }
      }
    })
    return groups
  }

  //line added by pratham
  // Ranking: collectors sorted by total verified amount collected (cash + UPI), descending (excluding admin/adhyaksha & manager)
  function buildRankingFromGroups(groups: Record<string, CollectorGroup>) {
    return Object.values(groups)
      .filter(c => {
        if (c.id === 'direct_or_unknown') return false
        const role = c.donations[0]?.users?.role
        if (role && ['admin', 'manager'].includes(role)) return false
        return true
      })
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
  }

  //line added by pratham  start line
  // Donor Ranking: group verified donations by donor phone, sorted by total donated descending
  interface DonorGroup {
    phone: string
    name: string
    totalAmount: number
    donationCount: number
  }

  function buildDonorRanking(list: Donation[]) {
    const donorGroupsMap: Record<string, DonorGroup> = {}
    list.filter(d => d.status === 'verified').forEach(d => {
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
    return Object.values(donorGroupsMap).sort((a, b) => b.totalAmount - a.totalAmount)
  } //End

  // ── Donations Summary & Support Fund — scoped to the selected event ("All Events" by default) ──
  const summaryDonations = filterDonationsByEvent(donations, summaryEventFilter)
  const summarySelfDonations = summaryDonations.filter(d => d.payment_mode === 'upi_self')
  const summaryNonSelfDonations = summaryDonations.filter(d => d.payment_mode !== 'upi_self')

  const selfDonations = summarySelfDonations
  const nonSelfDonations = summaryNonSelfDonations

  // Calculate stats for non-self (collector) donations
  const collectorTotalCount = nonSelfDonations.length
  const collectorTotalAmount = nonSelfDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const collectorPendingCount = nonSelfDonations.filter(d => d.status === 'pending').length

  // Calculate stats for self donations
  const selfTotalCount = selfDonations.length
  const selfTotalAmount = selfDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const selfPendingCount = selfDonations.filter(d => d.status === 'pending').length

  const collectorGroups = groupByCollector(nonSelfDonations)
  const collectorList = Object.values(collectorGroups).sort((a, b) => a.name.localeCompare(b.name))
  const visibleCollectorList = collectorList.filter(c => c.pendingCash > 0 || c.pendingUpi > 0)
  const pendingSelfCount = selfDonations.filter(d => d.status === 'pending').length

  const totalVerifiedCount = summaryDonations.filter(d => d.status === 'verified').length
  const selfVerifiedAmount = summarySelfDonations
    .filter(d => d.status === 'verified')
    .reduce((sum, d) => sum + Number(d.amount), 0)
  const collectorVerifiedAmount = summaryNonSelfDonations
    .filter(d => d.status === 'verified')
    .reduce((sum, d) => sum + Number(d.amount), 0)
  // Pending Amount = (unsettled UPI, status = pending) + (unsettled Cash, status = pending) + (upi-self, status = pending)
  // Pending Amount = (unsettled UPI, status = pending/verified) + (unsettled Cash, status = pending/verified) + (upi-self, status = pending)
  const totalPendingAmount = summaryDonations.reduce((sum, d) => {
    const amt = Number(d.amount)
    if (d.payment_mode === 'upi_self') {
      // Self donations: only those still pending verification
      return d.status === 'pending' ? sum + amt : sum
    }
    // Collector donations (cash / upi_collector): must be verified or pending status AND unsettled (no settlement_id)
    if ((d.status === 'verified' || d.status === 'pending') && !d.settlement_id) {
      return sum + amt
    }
    return sum
  }, 0)

  const summarySponsors = sponsorRankingList.filter(s => summaryEventFilter === 'all' || s.event_id === summaryEventFilter)
  const summarySponsorsCount = summarySponsors.length
  const summarySponsorsEstimatedAmount = summarySponsors.reduce((sum, s) => {
    const value = s.sponsor_type === 'goods_service' ? (s.estimated_value || 0) : s.committed_amount
    return sum + Number(value || 0)
  }, 0)

  // ── Ranking tab — scoped to the selected event ("All Events" by default) ──
  const rankingDonations = filterDonationsByEvent(donations, rankingEventFilter)
  const rankingNonSelfDonations = rankingDonations.filter(d => d.payment_mode !== 'upi_self')
  const rankingCollectorGroups = groupByCollector(rankingNonSelfDonations)
  const rankingList = buildRankingFromGroups(rankingCollectorGroups)
  const topRankingAmount = rankingList.length > 0 ? rankingList[0].totalAmount : 0
  const donorRankingList = buildDonorRanking(rankingDonations)
  const rankingSponsorList = sponsorRankingList.filter(s => rankingEventFilter === 'all' || s.event_id === rankingEventFilter)

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

    const matchesEvent = historyEventFilter === 'all' || d.event_id === historyEventFilter

    return matchesSearch && matchesCollector && matchesType && matchesEvent
  })

  // Number of non-default filters currently applied — shown as a badge on the Filter button
  const historyActiveFilterCount = [historyEventFilter, historyCollectorFilter, historyTypeFilter]
    .filter(v => v !== 'all').length

  const filteredHistorySponsors = sponsorRankingList.filter(s => {
    const query = historySearch.toLowerCase().trim()
    const matchesSearch = !query || s.company_name.toLowerCase().includes(query)
    const matchesEvent = historySponsorEventFilter === 'all' || s.event_id === historySponsorEventFilter
    return matchesSearch && matchesEvent
  })

  // Get distinct list of collectors who have collections across all events (for history filtering)
  const distinctCollectors: { id: string; name: string }[] = []
  donations.forEach(d => {
    if (d.payment_mode !== 'upi_self' && d.collected_by && d.users?.full_name) {
      if (!distinctCollectors.some(col => col.id === d.collected_by)) {
        distinctCollectors.push({ id: d.collected_by, name: d.users.full_name })
      }
    }
  })
  distinctCollectors.sort((a, b) => a.name.localeCompare(b.name))

  // Password complexity check states (for Reset Password)
  const passLength = tempPassword.length >= 8
  const passUpper = /[A-Z]/.test(tempPassword)
  const passLower = /[a-z]/.test(tempPassword)
  const passNumber = /[0-9]/.test(tempPassword)
  const passSpecial = /[^A-Za-z0-9]/.test(tempPassword)
  const isPasswordStrong = passLength && passUpper && passLower && passNumber && passSpecial

  // Password complexity check states (for Add Member)
  const memberPassLength = memberPassword.length >= 8
  const memberPassUpper = /[A-Z]/.test(memberPassword)
  const memberPassLower = /[a-z]/.test(memberPassword)
  const memberPassNumber = /[0-9]/.test(memberPassword)
  const memberPassSpecial = /[^A-Za-z0-9]/.test(memberPassword)
  const isMemberPasswordStrong = memberPassLength && memberPassUpper && memberPassLower && memberPassNumber && memberPassSpecial

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
  async function handleBannerContinue() {
    setShowUpgradeBanner(false)
    const headers = await getAuthHeaders()
    // Execute the pending action they tried before the banner appeared
    if (pendingVerifyId) {
      const id = pendingVerifyId
      setPendingVerifyId(null)
      // Now actually run verify, bypassing the subscription check
      setVerifyingId(id)
      fetch('/api/donations/verify', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ donation_id: id, verified_by: userId, status: 'verified' })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          showToast('Donation verified', 'success')
          setDonations(prev => prev.map(d =>
            d.id === id ? { ...d, status: 'verified', receipt_data: data.receipt_data || d.receipt_data, rejection_reason: null } : d
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
        headers,
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
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-955 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[#7a6a55] dark:text-gray-500 text-xs font-mono animate-pulse">Loading dashboard...</p>
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
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white transition-colors duration-300">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 px-4 py-3 rounded-lg text-sm font-medium shadow-xl
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
      <div className="bg-[#F5EDE2] dark:bg-gray-900 border-b border-[#1A1208]/10 dark:border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 transition-colors duration-300">
        <div className="min-w-0">
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Intellidon</p>
          <p className="text-sm sm:text-base font-bold text-[#1A1208] dark:text-white truncate max-w-40 sm:max-w-none">{mandalName}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full capitalize
            ${userRole === 'admin'
              ? 'bg-[#E8650A]/10 text-[#E8650A] dark:bg-orange-900/50 dark:text-orange-400 border border-[#E8650A]/20'
              : 'bg-blue-500/10 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 border border-blue-500/20'}`}>
            {userRole === 'admin' ? 'Adhyaksha' : 'Khajindar'}
          </span>
          <button
            onClick={() => router.push('/share')}
            className="text-[10px] sm:text-xs bg-[#FDF8F3] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-600 px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium"
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
                  : 'bg-[#FDF8F3] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-600'}`}
          >
            {sub.isExpired ? '⚠ Expired' : sub.daysRemaining <= 7 ? `⚠ ${sub.daysRemaining}d` : '📋 Plan'}
          </button>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Subscription strip */}
      {!sub.loading && (
        <div
          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b shadow-xs transition-colors
            ${sub.isExpired
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-red-400'
              : sub.daysRemaining <= 7
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-yellow-400'
                : 'bg-[#F5EDE2] dark:bg-gray-900/90 border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <span className={`font-bold capitalize
              ${sub.isExpired ? 'text-rose-700 dark:text-red-400' : sub.daysRemaining <= 7 ? 'text-amber-800 dark:text-yellow-400' : 'text-[#1A1208] dark:text-white'}`}>
              {sub.isExpired
                ? '⚠ Subscription expired — history, events, and team management are locked'
                : sub.subscription
                  ? `${sub.subscription.plan.charAt(0).toUpperCase() + sub.subscription.plan.slice(1)} plan · ${sub.daysRemaining} days remaining`
                  : 'No active subscription'}
            </span>
          </div>
          <button
            onClick={() => router.push('/dashboard/subscription')}
            className={`shrink-0 font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer
              ${sub.isExpired
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : sub.daysRemaining <= 7
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'text-[#E8650A] dark:text-orange-400 hover:underline'}`}
          >
            {sub.isExpired ? 'Upgrade now' : sub.daysRemaining <= 7 ? 'Renew' : 'View plan'}
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Role notice for manager */}
        {userRole === 'manager' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-5 text-xs text-blue-700 dark:text-blue-300 font-medium">
            You are logged in as <strong className="font-bold">Khajindar (Manager)</strong>. You can view donations, verify cash, and view events. Team and event management is handled by the Adhyaksha.
          </div>
        )}

        {/* Summary cards */}
        {tab === 'donations' && summary && (
          <div className="flex flex-col gap-6 mb-6">
            {/* Unified Donations Summary */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 px-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📊</span>
                  <h3 className="text-xs font-semibold text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider">
                    Donations Summary
                  </h3>
                </div>
                <select
                  value={summaryEventFilter}
                  onChange={e => setSummaryEventFilter(e.target.value)}
                  className="bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs text-[#1A1208] dark:text-gray-300 focus:outline-none focus:border-[#E8650A] transition-colors font-medium"
                >
                  <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Events</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{ev.name} {ev.year}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total verified donation', value: totalVerifiedCount },
                  { label: 'Self-donation (Verified)', value: formatAmount(selfVerifiedAmount) },
                  { label: 'Collected by Collectors (Verified)', value: formatAmount(collectorVerifiedAmount) },
                  { label: 'Pending Amount', value: formatAmount(totalPendingAmount) },
                  { label: 'Sponsors', value: summarySponsorsCount },
                  { label: 'Estimated Sponsors Amount', value: formatAmount(summarySponsorsEstimatedAmount) },
                ].map(card => (
                  <div key={card.label} className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700/50 rounded-xl p-4 flex flex-col h-full shadow-sm">
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-2 font-medium">{card.label}</p>
                    <p className="text-xl font-bold text-[#1A1208] dark:text-white mt-auto">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs — only show tabs the role has access to */}
        <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 rounded-xl p-1 border border-[#1A1208]/10 dark:border-gray-800 mb-6 w-full sm:w-fit overflow-x-auto">
          {availableTabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold capitalize transition-colors whitespace-nowrap shrink-0
                ${tab === t ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20' : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── TAB: Donations ── */}
        {tab === 'donations' && (
          <div className="flex flex-col gap-4">

            {/* Sub-tab toggle: Support Fund / Sponsorship — mirrors the Ranking tab pattern */}
            <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 rounded-xl p-1 border border-[#1A1208]/10 dark:border-gray-800 w-full sm:w-fit">
              {(['support_fund', 'sponsorship'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setDonationSubTab(st)}
                  className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap
                    ${donationSubTab === st ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20' : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'}`}
                >
                  {st === 'support_fund' ? '💵 Support Fund' : '🤝 Sponsorship'}
                </button>
              ))}
            </div>

            {donationSubTab === 'support_fund' && (
              <>
                {/* Direct Self-Donation Drawer Toggle Button */}
                <div className="flex justify-between items-center bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-[#1A1208] dark:text-white">Direct Self-Donations</h3>
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Donations made directly by scanning the QR code</p>
                  </div>
                  <button
                    onClick={() => setIsSelfDrawerOpen(true)}
                    className="bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
                  >
                    🌐 Verify Self-Donations
                    {pendingSelfCount > 0 && (
                      <span className="bg-white text-[#E8650A] text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                        {pendingSelfCount}
                      </span>
                    )}
                  </button>
                </div>

                {donationsLoading ? (
                  <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading donations...</p>
                ) : visibleCollectorList.length === 0 ? (
                  <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl shadow-sm">
                    <p className="text-[#1A1208] dark:text-gray-300 text-sm font-bold">No collectors awaiting settlement.</p>
                    <p className="text-[#7a6a55] dark:text-gray-500 text-xs mt-1 font-medium">All collections have been settled successfully.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold px-1 uppercase tracking-wider">Collectors Awaiting Settlement</p>
                    {visibleCollectorList.map(c => {
                      const isExpanded = expandedCollectors[c.id]
                      const hasPendingCash = c.pendingCash > 0
                      const isPending = c.pendingCash > 0 || c.pendingUpi > 0

                      return (
                        <div
                          key={c.id}
                          className={`bg-white dark:bg-gray-900 border rounded-xl overflow-hidden transition-all duration-200 shadow-sm
                        ${isExpanded ? 'border-[#E8650A]/50 shadow-md' : 'border-[#1A1208]/10 dark:border-gray-800'}`}
                        >
                          {/* Main Row clickable to toggle expansion */}
                          <div
                            onClick={() => setExpandedCollectors(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-[#F5EDE2]/40 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base font-bold text-[#1A1208] dark:text-white">{c.name}</span>
                                <span className="text-xs bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                  {c.donations.filter(d => (d.status === 'verified' || d.status === 'pending') && !d.settlement_id).length} unsettled collection{c.donations.filter(d => (d.status === 'verified' || d.status === 'pending') && !d.settlement_id).length !== 1 ? 's' : ''}
                                </span>
                              </div>

                              {/* Cash & UPI breakdown */}
                              <div className="flex gap-4 mt-2 text-xs flex-wrap">
                                <div className="bg-[#F5EDE2]/80 dark:bg-gray-950/60 rounded-lg px-3 py-1.5 border border-[#1A1208]/10 dark:border-gray-800/80">
                                  <span className="text-[#7a6a55] dark:text-gray-500 mr-1.5 font-bold">Unsettled Cash:</span>
                                  <span className="font-bold text-[#E8650A] dark:text-yellow-400">{formatAmount(c.pendingCash)}</span>
                                </div>
                                <div className="bg-[#F5EDE2]/80 dark:bg-gray-950/60 rounded-lg px-3 py-1.5 border border-[#1A1208]/10 dark:border-gray-800/80">
                                  <span className="text-[#7a6a55] dark:text-gray-500 mr-1.5 font-bold">Unsettled UPI:</span>
                                  <span className="font-bold text-[#E8650A] dark:text-yellow-400">{formatAmount(c.pendingUpi)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Action buttons & Arrow */}
                            <div className="flex items-center gap-2 flex-wrap justify-end self-end md:self-auto" onClick={e => e.stopPropagation()}>
                              {isPending && CAN.verifyDonation(userRole) && (
                                <>
                                  {c.pendingCash > 0 && c.pendingUpi > 0 ? (
                                    <button
                                      onClick={() => setBulkVerifyModalCollector(c)}
                                      disabled={bulkVerifyingCollector === c.id}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-md"
                                    >
                                      {bulkVerifyingCollector === c.id ? 'Settling...' : '✓ Settle Handover'}
                                    </button>
                                  ) : c.pendingCash > 0 ? (
                                    <button
                                      onClick={() => settleCollector(c.id, 'cash')}
                                      disabled={bulkVerifyingCollector === c.id}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-md"
                                    >
                                      {bulkVerifyingCollector === c.id ? 'Settling...' : `✓ Verify Cash Handover (${formatAmount(c.pendingCash)})`}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => settleCollector(c.id, 'upi')}
                                      disabled={bulkVerifyingCollector === c.id}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-md"
                                    >
                                      {bulkVerifyingCollector === c.id ? 'Settling...' : `✓ Verify UPI Handover (${formatAmount(c.pendingUpi)})`}
                                    </button>
                                  )}
                                </>
                              )}

                              <button
                                onClick={() => setExpandedCollectors(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white p-1.5 ml-1 cursor-pointer transition-colors"
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
                                          {d.receipt_data && d.status === 'verified' ? (
                                            <button
                                              onClick={() => downloadReceipt(d.receipt_data!)}
                                              className="inline-block bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#eaddce] dark:hover:bg-gray-700 text-[#7a6a55] dark:text-gray-300 font-medium px-2 py-1 rounded transition-colors text-[10px] cursor-pointer"
                                            >
                                              ↓ Receipt
                                            </button>
                                          ) : (
                                            <span className="text-[#7a6a55] dark:text-gray-600">—</span>
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
              </>
            )}

            {donationSubTab === 'sponsorship' && (
              <SponsorshipSection mandalId={mandalId!} events={events} showToast={showToast} />
            )}
          </div>
        )}


        {/* ── TAB: Ranking (Collectors + Donors) ── */}
        {tab === 'ranking' && (
          <div className="flex flex-col gap-4">

            {/* Sub-tab toggle + event scope selector (applies to whichever sub-tab is active) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 rounded-xl p-1 border border-[#1A1208]/10 dark:border-gray-800 w-full sm:w-fit">
                {(['collectors', 'donors', 'sponsors'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setRankingSubTab(st)}
                    className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold capitalize transition-colors whitespace-nowrap cursor-pointer
                      ${rankingSubTab === st ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20' : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'}`}
                  >
                    {st === 'collectors' ? '👥 Collectors' : st === 'donors' ? '🎗️ Donors' : '🤝 Sponsors'}
                  </button>
                ))}
              </div>
              <select
                value={rankingEventFilter}
                onChange={e => setRankingEventFilter(e.target.value)}
                className="bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-bold focus:outline-none focus:border-[#E8650A] transition-colors w-full sm:w-auto"
              >
                <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Events</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{ev.name} {ev.year}</option>
                ))}
              </select>
            </div>

            {/* ── Collector Ranking ── */}
            {rankingSubTab === 'collectors' && (
              donationsLoading ? (
                <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading ranking...</p>
              ) : rankingList.length === 0 ? (
                <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                  <p className="text-[#7a6a55] dark:text-gray-500 text-sm font-bold">No collector activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold px-1 uppercase tracking-wider">
                    Leaderboard — by total amount collected
                  </p>
                  {rankingList.map((c, index) => {
                    const rank = index + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                    return (
                      <div
                        key={c.id}
                        className={`bg-white dark:bg-gray-900 border rounded-xl p-4 flex items-center gap-4 shadow-sm
                          ${rank === 1 ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-[#1A1208]/10 dark:border-gray-800'}`}
                      >
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold
                          ${rank <= 3 ? 'bg-[#F5EDE2] dark:bg-gray-800 text-[#1A1208] dark:text-white' : 'bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-gray-400'}`}>
                          {medal ? <span className="text-xl">{medal}</span> : <span>#{rank}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold text-[#1A1208] dark:text-white truncate">{c.name}</span>
                            <span className="text-sm font-extrabold text-[#1A1208] dark:text-white shrink-0">{formatAmount(c.totalAmount)}</span>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[11px] text-[#7a6a55] dark:text-gray-400 font-medium">
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
                <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading ranking...</p>
              ) : donorRankingList.length === 0 ? (
                <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                  <p className="text-[#7a6a55] dark:text-gray-500 text-sm font-bold">No donor activity yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold px-1 uppercase tracking-wider">
                    Top Donors — by total amount donated
                  </p>
                  {donorRankingList.map((d, index) => {
                    const rank = index + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                    return (
                      <div
                        key={d.phone + index}
                        className={`bg-white dark:bg-gray-900 border rounded-xl p-4 flex items-center gap-4 shadow-sm
                          ${rank === 1 ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-[#1A1208]/10 dark:border-gray-800'}`}
                      >
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold
                          ${rank <= 3 ? 'bg-[#F5EDE2] dark:bg-gray-800 text-[#1A1208] dark:text-white' : 'bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-gray-400'}`}>
                          {medal ? <span className="text-xl">{medal}</span> : <span>#{rank}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-bold text-[#1A1208] dark:text-white truncate">{d.name}</span>
                            <span className="text-sm font-extrabold text-[#1A1208] dark:text-white shrink-0">{formatAmount(d.totalAmount)}</span>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[11px] text-[#7a6a55] dark:text-gray-400 font-medium">
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

            {/* ── Sponsor Ranking ── */}
            {rankingSubTab === 'sponsors' && (
              sponsorRankingLoading ? (
                <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading ranking...</p>
              ) : rankingSponsorList.length === 0 ? (
                <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                  <p className="text-[#7a6a55] dark:text-gray-500 text-sm font-bold">No sponsors added yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold px-1 uppercase tracking-wider">
                    Sponsors — by contribution value
                  </p>
                  {[...rankingSponsorList]
                    .sort((a, b) => {
                      const valueOf = (s: typeof a) => s.sponsor_type === 'goods_service' ? (s.estimated_value || 0) : s.committed_amount
                      return valueOf(b) - valueOf(a)
                    })
                    .map((s, index) => {
                      const rank = index + 1
                      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                      const isGoods = s.sponsor_type === 'goods_service'
                      const value = isGoods ? (s.estimated_value || 0) : s.committed_amount
                      return (
                        <div
                          key={s.id}
                          className={`bg-white dark:bg-gray-900 border rounded-xl p-4 flex items-center gap-4 shadow-sm
                            ${rank === 1 ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-[#1A1208]/10 dark:border-gray-800'}`}
                        >
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold
                            ${rank <= 3 ? 'bg-[#F5EDE2] dark:bg-gray-800 text-[#1A1208] dark:text-white' : 'bg-[#F5EDE2] dark:bg-gray-800 text-[#7a6a55] dark:text-gray-400'}`}>
                            {medal ? <span className="text-xl">{medal}</span> : <span>#{rank}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-sm font-bold text-[#1A1208] dark:text-white truncate">{s.company_name}</span>
                              <span className="text-sm font-extrabold text-[#1A1208] dark:text-white shrink-0">{formatAmount(value)}</span>
                            </div>
                            <div className="flex gap-3 mt-1.5 text-[11px] text-[#7a6a55] dark:text-gray-400 font-medium">
                              <span>{isGoods ? '📦 Goods/Service' : '💰 Finance'}</span>
                              {!isGoods && <span>Received: {formatAmount(s.amount_received)}</span>}
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
        {tab === 'history' && (
          <div className="flex flex-col gap-4">

            {/* Record type toggle */}
            <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 rounded-xl p-1 border border-[#1A1208]/10 dark:border-gray-800 w-full sm:w-fit">
              {(['donations', 'sponsors'] as const).map(rt => (
                <button
                  key={rt}
                  onClick={() => setHistoryRecordType(rt)}
                  className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold capitalize transition-colors whitespace-nowrap cursor-pointer
                    ${historyRecordType === rt ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md shadow-[#E8650A]/20' : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'}`}
                >
                  {rt === 'donations' ? '🎗️ Donations' : '🤝 Sponsors'}
                </button>
              ))}
            </div>

            {historyRecordType === 'donations' && (
              <>
                {/* Search and Filters Bar */}
                <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center shadow-sm">

                  {/* Search input */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search by donor name, phone, amount, or receipt..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
                    />
                    <span className="absolute left-3 top-2 text-[#7a6a55] dark:text-gray-500 text-xs">
                      🔍
                    </span>
                  </div>

                  {/* Single combined Filter button — Event / Donation Type / Payment Mode */}
                  <div className="relative w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setHistoryFilterOpen(o => !o)}
                      className="w-full md:w-auto flex items-center justify-center gap-1.5 bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-4 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-bold hover:border-[#E8650A] transition-colors cursor-pointer"
                    >
                      ⚙️ Filter
                      {historyActiveFilterCount > 0 && (
                        <span className="bg-[#E8650A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {historyActiveFilterCount}
                        </span>
                      )}
                    </button>

                    {historyFilterOpen && (
                      <>
                        {/* Click-outside backdrop to close the panel */}
                        <div className="fixed inset-0 z-10" onClick={() => setHistoryFilterOpen(false)} />
                        <div className="absolute right-0 z-20 mt-2 w-full sm:w-72 bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-xl shadow-2xl p-4 flex flex-col gap-3">
                          {/* Event filter */}
                          <div>
                            <label className="text-[11px] text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Event</label>
                            <select
                              value={historyEventFilter}
                              onChange={e => setHistoryEventFilter(e.target.value)}
                              className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
                            >
                              <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Events</option>
                              {events.map(ev => (
                                <option key={ev.id} value={ev.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{ev.name} {ev.year}</option>
                              ))}
                            </select>
                          </div>

                          {/* Donation Type filter (collectors / self-donation / individual collector) */}
                          <div>
                            <label className="text-[11px] text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Donation Type</label>
                            <select
                              value={historyCollectorFilter}
                              onChange={e => setHistoryCollectorFilter(e.target.value)}
                              className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
                            >
                              <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Collectors</option>
                              <option value="self" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">Self-Donations (Online)</option>
                              {distinctCollectors.map(c => (
                                <option key={c.id} value={c.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Payment Mode filter */}
                          <div>
                            <label className="text-[11px] text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Payment Mode</label>
                            <select
                              value={historyTypeFilter}
                              onChange={e => setHistoryTypeFilter(e.target.value)}
                              className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
                            >
                              <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Modes</option>
                              <option value="cash" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">💵 Cash</option>
                              <option value="upi_collector" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">📱 UPI (collector)</option>
                              <option value="upi_self" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">📱 UPI (self)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setHistoryEventFilter('all')
                              setHistoryCollectorFilter('all')
                              setHistoryTypeFilter('all')
                            }}
                            className="text-[11px] text-[#7a6a55] dark:text-gray-500 hover:text-[#E8650A] dark:hover:text-orange-400 underline self-center pt-1 transition-colors cursor-pointer"
                          >
                            Reset Filters
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Export buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportCSV(filteredHistoryDonations, `mandal_history_${new Date().toISOString().slice(0, 10)}.csv`)}
                    disabled={filteredHistoryDonations.length === 0}
                    className="flex-1 sm:flex-initial sm:px-6 py-2 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => handleExportPDF(filteredHistoryDonations, 'Mandal Collection History Report')}
                    disabled={filteredHistoryDonations.length === 0}
                    className="flex-1 sm:flex-initial sm:px-6 py-2 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    📄 Export PDF
                  </button>
                </div>

                {/* Donations Table/List */}
                {donationsLoading ? (
                  <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading history...</p>
                ) : filteredHistoryDonations.length === 0 ? (
                  <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                    <p className="text-[#7a6a55] dark:text-gray-500 text-sm font-bold">No donations match your filters.</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 bg-[#F5EDE2] dark:bg-gray-950/40 text-[#7a6a55] dark:text-gray-400 font-bold">
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
                        <tbody className="divide-y divide-[#1A1208]/5 dark:divide-gray-800/50">
                          {filteredHistoryDonations.map(d => (
                            <tr key={d.id} className="hover:bg-[#F5EDE2]/40 dark:hover:bg-gray-800/10 transition-colors">
                              <td className="p-3 font-mono text-[#7a6a55] dark:text-gray-400 font-semibold">{d.receipt_number}</td>
                              <td className="p-3 font-bold text-[#1A1208] dark:text-white">{d.donor_name}</td>
                              <td className="p-3 text-[#7a6a55] dark:text-gray-400 font-medium">{d.donor_phone}</td>
                              <td className="p-3 font-bold text-[#1A1208] dark:text-white">{formatAmount(d.amount)}</td>
                              <td className="p-3 text-[#1A1208] dark:text-gray-300 font-medium">
                                {d.payment_mode === 'upi_self' ? '🌐 Self' : (d.users?.full_name || 'Unknown')}
                              </td>
                              <td className="p-3 text-[#7a6a55] dark:text-gray-400 font-medium">
                                {d.payment_mode === 'cash' ? '💵 Cash'
                                  : d.payment_mode === 'upi_collector' ? '📱 UPI (C)'
                                    : '📱 UPI (S)'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide
                              ${d.status === 'verified' ? 'bg-emerald-500/10 text-emerald-600 dark:text-green-400 border border-emerald-500/20'
                                    : d.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-red-400 border border-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-yellow-400 border border-amber-500/20'}`}>
                                  {d.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {d.receipt_data && d.status === 'verified' ? (
                                  <button
                                    onClick={() => downloadReceipt(d.receipt_data!)}
                                    className="inline-block bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#eaddce] dark:hover:bg-gray-700 text-[#7a6a55] dark:text-gray-300 font-bold px-2.5 py-1 rounded-lg transition-colors text-[10px] cursor-pointer border border-[#1A1208]/10 dark:border-gray-700"
                                  >
                                    ↓ Receipt
                                  </button>
                                ) : (
                                  <span className="text-[#7a6a55] dark:text-gray-600">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {historyRecordType === 'sponsors' && (
              <>
                {/* Search and Event filter */}
                <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 md:flex-row md:items-center shadow-sm">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search by sponsor company name..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A] transition-colors"
                    />
                    <span className="absolute left-3 top-2 text-[#7a6a55] dark:text-gray-500 text-xs">🔍</span>
                  </div>
                  <select
                    value={historySponsorEventFilter}
                    onChange={e => setHistorySponsorEventFilter(e.target.value)}
                    className="w-full md:w-auto bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-gray-300 font-bold focus:outline-none focus:border-[#E8650A] transition-colors"
                  >
                    <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Events</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{ev.name} {ev.year}</option>
                    ))}
                  </select>
                </div>

                {/* Export buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportSponsorCSV(filteredHistorySponsors, `sponsor_history_${new Date().toISOString().slice(0, 10)}.csv`)}
                    disabled={filteredHistorySponsors.length === 0}
                    className="flex-1 sm:flex-initial sm:px-6 py-2 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={() => handleExportSponsorPDF(filteredHistorySponsors, 'Sponsorship History Report')}
                    disabled={filteredHistorySponsors.length === 0}
                    className="flex-1 sm:flex-initial sm:px-6 py-2 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    📄 Export PDF
                  </button>
                </div>

                {/* Sponsors Table */}
                {sponsorRankingLoading ? (
                  <p className="text-[#7a6a55] dark:text-gray-400 text-sm text-center py-12 font-medium">Loading sponsors...</p>
                ) : filteredHistorySponsors.length === 0 ? (
                  <div className="text-center py-12 bg-[#F5EDE2]/60 dark:bg-gray-900/30 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl">
                    <p className="text-[#7a6a55] dark:text-gray-500 text-sm font-bold">No sponsors match your filters.</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#1A1208]/10 dark:border-gray-800 bg-[#F5EDE2] dark:bg-gray-950/40 text-[#7a6a55] dark:text-gray-400 font-bold">
                            <th className="p-3">Company</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Event</th>
                            <th className="p-3">Contact</th>
                            <th className="p-3">Committed / Est. Value</th>
                            <th className="p-3">Received</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1208]/5 dark:divide-gray-800/50">
                          {filteredHistorySponsors.map(s => {
                            const ev = events.find(e => e.id === s.event_id)
                            const isGoods = s.sponsor_type === 'goods_service'
                            return (
                              <tr key={s.id} className="hover:bg-[#F5EDE2]/40 dark:hover:bg-gray-800/10 transition-colors">
                                <td className="p-3 font-bold text-[#1A1208] dark:text-white">{s.company_name}</td>
                                <td className="p-3 text-[#7a6a55] dark:text-gray-400 font-medium">{isGoods ? '📦 Goods/Service' : '💰 Finance'}</td>
                                <td className="p-3 text-[#7a6a55] dark:text-gray-400 font-medium">{ev ? `${ev.name} ${ev.year}` : '—'}</td>
                                <td className="p-3 text-[#1A1208] dark:text-gray-300 font-medium">
                                  {s.contact_person_name || '—'}{s.contact_person_phone ? ` · ${s.contact_person_phone}` : ''}
                                </td>
                                <td className="p-3 font-bold text-[#1A1208] dark:text-white">
                                  {formatAmount(isGoods ? (s.estimated_value || 0) : s.committed_amount)}
                                </td>
                                <td className="p-3 text-[#1A1208] dark:text-gray-300 font-bold">{formatAmount(s.amount_received)}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide
                                    ${s.payment_status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-green-400 border border-emerald-500/20'
                                      : s.payment_status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-yellow-400 border border-amber-500/20'
                                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'}`}>
                                    {s.payment_status.replace('_', ' ')}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Events (admin + manager can VIEW, only admin can edit) ── */}
        {tab === 'events' && CAN.seeEventsTab(userRole) && (
          expenseManagerEvent && mandalId ? (
            <ExpenseManagerPanel
              mandalId={mandalId}
              eventId={expenseManagerEvent.id}
              eventLabel={`${expenseManagerEvent.name} ${expenseManagerEvent.year}`}
              showToast={showToast}
              onBack={() => setExpenseManagerEvent(null)}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Event Activation Note Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed shadow-xs">
                <span className="text-amber-600 dark:text-amber-400 text-base font-bold shrink-0">📌</span>
                <div>
                  <strong className="font-bold text-[#1A1208] dark:text-white block mb-0.5">Important: Event Activation Required</strong>
                  To accept donations (from collectors or public self-donation links), you <strong>must activate an event</strong>. Click the <strong>⚡ Activate</strong> button on your desired event. Only one event can be live at a time.
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-[#7a6a55] dark:text-gray-400 font-bold">{events.length} event{events.length !== 1 ? 's' : ''}</p>
                {CAN.createEvent(userRole) && (
                  <button
                    onClick={() => {
                      if (showEventForm) {
                        cancelEventForm()
                      } else {
                        setEditingEventId(null)
                        setEventName('')
                        setEventYear(new Date().getFullYear().toString())
                        setEventUpiId(mandalKyc?.upi_id || '')
                        setEventStartDate('')
                        setEventEndDate('')
                        setDateError('')
                        setShowEventForm(true)
                      }
                    }}
                    className="text-xs bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
                  >
                    {showEventForm ? 'Close Form' : '+ New Event'}
                  </button>
                )}
              </div>

              {showEventForm && CAN.createEvent(userRole) && (
                <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                  <p className="text-sm font-bold text-[#1A1208] dark:text-white">
                    {editingEventId ? 'Edit Event' : 'Create New Event'}
                  </p>

                  {/* Event name */}
                  <div>
                    <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Event Name *</label>
                    <input
                      value={eventName}
                      onChange={e => setEventName(e.target.value)}
                      placeholder="e.g. Ganeshotsav"
                      className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Year</label>
                    <input
                      value={eventYear}
                      disabled
                      type="number"
                      className="w-full bg-white/60 dark:bg-gray-950 border border-[#1A1208]/10 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-[#7a6a55] dark:text-gray-500 font-mono font-medium cursor-not-allowed"
                    />
                  </div>

                  {/* UPI ID — pre-filled from registration & editable */}
                  <div>
                    <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">UPI ID *</label>
                    <input
                      value={eventUpiId}
                      onChange={e => setEventUpiId(e.target.value)}
                      placeholder="e.g. mandal@okaxis"
                      className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]"
                    />
                    <p className="text-xs text-[#7a6a55] dark:text-gray-500 mt-1 font-medium flex items-center justify-between">
                      <span>Pre-filled from registration. You can edit this for the event.</span>
                      {mandalKyc?.upi_id && eventUpiId !== mandalKyc.upi_id && (
                        <button
                          type="button"
                          onClick={() => setEventUpiId(mandalKyc.upi_id)}
                          className="text-[10px] text-[#E8650A] hover:underline font-bold cursor-pointer ml-2"
                        >
                          Reset to Org UPI ({mandalKyc.upi_id})
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Date row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Start Date *</label>
                      <input
                        type="date"
                        value={eventStartDate}
                        onChange={e => { setEventStartDate(e.target.value); setDateError('') }}
                        min={
                          editingEventId && eventStartDate && eventStartDate < new Date().toISOString().split('T')[0]
                            ? eventStartDate
                            : new Date().toISOString().split('T')[0]
                        }
                        className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white font-medium focus:outline-none focus:border-[#E8650A]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">End Date *</label>
                      <input
                        type="date"
                        value={eventEndDate}
                        onChange={e => { setEventEndDate(e.target.value); setDateError('') }}
                        min={
                          editingEventId && eventEndDate && eventEndDate < (eventStartDate || new Date().toISOString().split('T')[0])
                            ? eventEndDate
                            : (eventStartDate || new Date().toISOString().split('T')[0])
                        }
                        className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white font-medium focus:outline-none focus:border-[#E8650A]"
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
                      <div className={`text-xs px-3 py-2 rounded-lg font-bold ${days > 50 ? 'bg-rose-500/10 text-rose-600 dark:text-red-400 border border-rose-500/20' : 'bg-white dark:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600'}`}>
                        Duration: <span className="font-bold">{days} days</span>
                        {days > 50 && ' — exceeds 50 day limit'}
                        {days <= 50 && ` of 50 day maximum`}
                      </div>
                    ) : null
                  })()}

                  {/* Date error */}
                  {dateError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                      <p className="text-rose-600 dark:text-red-400 text-xs font-bold">{dateError}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={editingEventId ? updateEvent : createEvent}
                      disabled={eventSubmitting}
                      className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#E8650A]/20"
                    >
                      {eventSubmitting ? 'Saving...' : editingEventId ? 'Save Changes' : 'Create Event'}
                    </button>
                    <button onClick={cancelEventForm} className="px-4 bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {events.length === 0 ? (
                <p className="text-[#7a6a55] dark:text-gray-500 text-sm text-center py-8 font-medium">
                  {CAN.createEvent(userRole) ? 'No events yet. Create one above.' : 'No events created yet. Ask the Adhyaksha to create an event.'}
                </p>
              ) : (
                events.map(ev => {
                  const isExpired = ev.is_expired || ev.end_date < new Date().toISOString().split('T')[0]
                  const isSuspended = ev.is_suspended
                  return (
                    <div key={ev.id} className={`bg-white dark:bg-gray-800 border rounded-xl p-4 shadow-sm transition-all
                    ${isExpired || isSuspended ? 'border-[#1A1208]/10 dark:border-gray-700 opacity-60' : 'border-[#1A1208]/15 dark:border-gray-700'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-[#1A1208] dark:text-white text-sm">{ev.name} {ev.year}</p>
                          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-mono font-medium">
                            {ev.upi_id ? `UPI: ${ev.upi_id}` : 'No UPI ID'}
                          </p>
                          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
                            {new Date(ev.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' — '}
                            {new Date(ev.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {ev.days_remaining > 0 && !isExpired && !isSuspended && (
                              <span className="text-[#E8650A] dark:text-orange-400 ml-2 font-bold">{ev.days_remaining} days left</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
                          ${isSuspended
                              ? 'bg-rose-500/10 text-rose-600 dark:text-red-400 border border-rose-500/20'
                              : isExpired
                                ? 'bg-[#F5EDE2] dark:bg-gray-700 text-[#7a6a55] dark:text-gray-400 border border-[#1A1208]/10 dark:border-gray-600'
                                : ev.is_active
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-green-400 border border-emerald-500/20'
                                  : 'bg-[#F5EDE2] dark:bg-gray-700 text-[#7a6a55] dark:text-gray-400 border border-[#1A1208]/10 dark:border-gray-600'}`}>
                            {isSuspended ? 'Suspended by Intellidon Admin' : isExpired ? 'Expired' : ev.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {/* Toggle only available if not expired and not suspended */}
                          {!isExpired && !isSuspended && CAN.toggleEvent(userRole) && (
                            <button
                              onClick={() => toggleEvent(ev.id, ev.is_active)}
                              className={`text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-sm ${
                                ev.is_active
                                  ? 'px-3 py-1.5 bg-gray-100 dark:bg-gray-700/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 border border-gray-300 dark:border-gray-600'
                                  : 'px-3.5 py-1.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white shadow-md shadow-[#E8650A]/30 border border-orange-500 hover:scale-105 animate-pulse'
                              }`}
                            >
                              {ev.is_active ? 'Deactivate' : '⚡ Activate Event'}
                            </button>
                          )}
                          {/* Edit only available if not expired and not suspended */}
                          {!isExpired && !isSuspended && CAN.createEvent(userRole) && (
                            <button
                              onClick={() => startEditingEvent(ev)}
                              className="text-xs text-[#E8650A] dark:text-orange-400 hover:underline transition-colors ml-2 font-bold cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {isExpired && (
                            <span className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">Permanently off</span>
                          )}
                        </div>
                      </div>
                      {CAN.manageExpenses(userRole) && (
                        <div className="mt-3 pt-3 border-t border-[#1A1208]/10 dark:border-gray-700">
                          <button
                            onClick={() => setExpenseManagerEvent(ev)}
                            className="text-xs bg-[#F5EDE2] dark:bg-gray-700/60 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 border border-[#1A1208]/10 dark:border-gray-600 px-3 py-1.5 rounded-lg transition-colors font-bold cursor-pointer"
                          >
                            💰 Manage Expenses
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )
        )}

        {/* ── TAB: Team (admin only) ── */}
        {tab === 'team' && CAN.seeTeamTab(userRole) && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#7a6a55] dark:text-gray-400 font-bold">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              <button
                onClick={() => setShowMemberForm(!showMemberForm)}
                className="text-xs bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
              >
                + Add Member
              </button>
            </div>

            {/* Role guide */}
            <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-4 text-xs text-[#7a6a55] dark:text-gray-400 leading-relaxed shadow-sm">
              <p className="font-bold text-[#1A1208] dark:text-white text-sm mb-2">Role guide</p>
              <p><span className="text-[#E8650A] dark:text-orange-400 font-bold">Adhyaksha (Admin)</span> — full access. Manages team, events, and sees all data.</p>
              <p className="mt-1"><span className="text-blue-600 dark:text-blue-400 font-bold">Khajindar (Manager)</span> — can view donations and verify cash. Cannot manage team or events.</p>
              <p className="mt-1"><span className="text-[#1A1208] dark:text-gray-300 font-bold">Sevak (Collector)</span> — can only enter new donations from their phone. Cannot see reports.</p>
            </div>

            {/* Add member form */}
            {showMemberForm && (
              <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <p className="text-sm font-bold text-[#1A1208] dark:text-white">Add Team Member</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['collector', 'manager'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setMemberRole(r)}
                      className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all cursor-pointer
                        ${memberRole === r ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-900 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400'}`}
                    >
                      {r === 'collector' ? 'Sevak' : 'Khajindar'}
                      <span className="block text-[10px] opacity-80 font-normal capitalize">{r}</span>
                    </button>
                  ))}
                </div>
                <input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Full name"
                  className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]" />
                <input value={memberPhone} onChange={e => setMemberPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} placeholder="Phone number (10 digits)" type="tel"
                  maxLength={10}
                  className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]" />
                <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Email (used to login)" type="email"
                  className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]" />
                <input value={memberPassword} onChange={e => setMemberPassword(e.target.value)} placeholder="Password (min 8 characters)" type="password"
                  className="bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 font-medium focus:outline-none focus:border-[#E8650A]" />

                {memberPassword && (
                  <div className="space-y-1 bg-white/60 dark:bg-gray-950/45 border border-[#1A1208]/10 dark:border-gray-800/80 rounded-lg p-2.5">
                    <p className="text-[9px] text-[#7a6a55] dark:text-gray-500 font-bold mb-1.5 uppercase tracking-wider">Password Requirements:</p>

                    <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                      <span className={memberPassword ? (memberPassLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                        {memberPassword ? (memberPassLength ? '✓' : '✗') : '•'} At least 8 characters
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                      <span className={memberPassword ? (memberPassUpper ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                        {memberPassword ? (memberPassUpper ? '✓' : '✗') : '•'} Uppercase letter (A-Z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                      <span className={memberPassword ? (memberPassLower ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                        {memberPassword ? (memberPassLower ? '✓' : '✗') : '•'} Lowercase letter (a-z)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                      <span className={memberPassword ? (memberPassNumber ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                        {memberPassword ? (memberPassNumber ? '✓' : '✗') : '•'} A number (0-9)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                      <span className={memberPassword ? (memberPassSpecial ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                        {memberPassword ? (memberPassSpecial ? '✓' : '✗') : '•'} Special character (e.g. #, @, $, !, %, &, *)
                      </span>
                    </div>
                  </div>
                )}

                {/* Event access */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Event Access</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" onClick={() => setMemberEventScope('all')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${memberEventScope === 'all' ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-900 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400'}`}>
                      All events
                    </button>
                    <button type="button" onClick={() => setMemberEventScope('specific')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${memberEventScope === 'specific' ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-900 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400'}`}>
                      Specific event(s)
                    </button>
                  </div>
                  {memberEventScope === 'specific' && (
                    events.length === 0 ? (
                      <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No events created yet.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg p-2.5">
                        {events.map(ev => (
                          <label key={ev.id} className="flex items-center gap-2 text-xs text-[#1A1208] dark:text-gray-300 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={memberEventIds.includes(ev.id)}
                              onChange={() => setMemberEventIds(prev =>
                                prev.includes(ev.id) ? prev.filter(id => id !== ev.id) : [...prev, ev.id]
                              )}
                              className="accent-[#E8650A]"
                            />
                            {ev.name} <span className="text-[#7a6a55] dark:text-gray-500">({ev.year})</span>
                          </label>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={addMember} disabled={memberSubmitting || !memberName || memberPhone.length !== 10 || !memberEmail || !isMemberPasswordStrong}
                    className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#E8650A]/20">
                    {memberSubmitting ? 'Adding...' : `Add ${memberRole === 'collector' ? 'Sevak' : 'Khajindar'}`}
                  </button>
                  <button onClick={() => setShowMemberForm(false)} className="px-4 bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600 text-xs font-bold rounded-xl transition-colors cursor-pointer">Cancel</button>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <p className="text-[#7a6a55] dark:text-gray-500 text-sm text-center py-8 font-medium">No team members yet.</p>
            ) : (
              members.map(m => (
                <div key={m.id} className={`bg-white dark:bg-gray-800 border rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 transition-colors shadow-sm ${m.is_active === false ? 'border-[#1A1208]/10 dark:border-gray-800 bg-[#F5EDE2]/50 dark:bg-gray-900/40 opacity-75' : 'border-[#1A1208]/15 dark:border-gray-700'
                  }`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${m.is_active === false ? 'text-[#7a6a55] dark:text-gray-500 line-through' : 'text-[#1A1208] dark:text-white'}`}>{m.full_name}</p>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider
                        ${m.role === 'admin' ? 'bg-[#E8650A]/10 text-[#E8650A] dark:text-orange-400 border border-[#E8650A]/20'
                          : m.role === 'manager' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : m.role === 'super_admin' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-[#F5EDE2] dark:bg-gray-700 text-[#7a6a55] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-600'}`}>
                        {m.role === 'admin' ? 'Adhyaksha'
                          : m.role === 'manager' ? 'Khajindar'
                            : m.role === 'collector' ? 'Sevak'
                              : m.role}
                      </span>
                      {m.is_active === false && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#F5EDE2] dark:bg-gray-900/60 text-[#7a6a55] dark:text-gray-400 border border-[#1A1208]/10 dark:border-gray-800">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-mono font-medium">{m.phone}</p>
                    {m.role !== 'admin' && (
                      <p className="text-[11px] text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">
                        {(!m.event_ids || m.event_ids.length === 0)
                          ? 'Access: all events'
                          : `Access: ${m.event_ids.length} event${m.event_ids.length !== 1 ? 's' : ''} — ${m.event_ids.map(id => events.find(e => e.id === id)?.name || '?').join(', ')
                          }`}
                      </p>
                    )}
                  </div>
                  {/* Cannot edit/remove/reset yourself, another admin, or super_admin */}
                  {m.id !== userId && !['admin', 'super_admin'].includes(m.role) ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openEditModal(m)}
                        className="text-xs bg-[#F5EDE2] dark:bg-gray-700/60 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 border border-[#1A1208]/10 dark:border-gray-600 px-2.5 py-1.5 rounded-lg transition-colors font-bold cursor-pointer"
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
                        className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer ${m.is_active === false
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
        <div className={`fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[#FDF8F3] dark:bg-gray-900 border-l border-[#1A1208]/15 dark:border-gray-800 shadow-2xl flex flex-col transition-transform duration-305 ease-in-out transform text-[#1A1208] dark:text-white
          ${isSelfDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

          <div className="p-4 border-b border-[#1A1208]/10 dark:border-gray-800 flex items-center justify-between bg-[#F5EDE2] dark:bg-gray-900/50 backdrop-blur">
            <div>
              <h3 className="font-bold text-[#1A1208] dark:text-white">Self-Donations Verification</h3>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Direct online payment uploads</p>
            </div>
            <button
              onClick={() => {
                setIsSelfDrawerOpen(false)
                setReviewingId(null)
                setScreenshotChecked(false)
              }}
              className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-gray-800 transition-colors font-bold cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selfDonations.length === 0 ? (
              <p className="text-[#7a6a55] dark:text-gray-500 text-sm text-center py-12 font-medium">No self-donations recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {selfDonations.map(d => {
                  const isReviewing = reviewingId === d.id
                  return (
                    <div
                      key={d.id}
                      className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden transition-all shadow-sm
                        ${isReviewing ? 'border-[#E8650A] ring-1 ring-[#E8650A]/30 bg-white dark:bg-gray-800' : 'border-[#1A1208]/10 dark:border-gray-700'}
                        ${d.status === 'rejected' ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20' : ''}`}
                    >
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-[#1A1208] dark:text-white text-sm">{d.donor_name || 'Anonymous Donor'}</p>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide
                              ${d.status === 'verified' ? 'bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-800/50'
                                : d.status === 'rejected' ? 'bg-rose-500/10 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-800/50'
                                  : 'bg-amber-500/10 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-800/50'}`}>
                              {d.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#7a6a55] dark:text-gray-300 mt-1 font-medium">
                            {d.donor_phone}{d.donor_address ? ` · ${d.donor_address}` : ''}
                          </p>
                          <p className="text-xs text-[#9e8c76] dark:text-gray-400 mt-1 font-medium">
                            {formatDate(d.created_at)}
                          </p>
                          {d.status === 'rejected' && d.rejection_reason && (
                            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-950/50 border border-rose-500/30 dark:border-rose-900/50 rounded-lg px-2.5 py-1.5 mt-2 font-medium">
                              Reason: {d.rejection_reason}
                            </p>
                          )}
                          <p className="text-xs font-mono text-[#9e8c76] dark:text-gray-400 mt-1">{d.receipt_number}</p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          <p className="text-lg font-extrabold text-[#1A1208] dark:text-white">{formatAmount(d.amount)}</p>

                          {d.status === 'pending' && CAN.verifyDonation(userRole) && !isReviewing && (
                            <button
                              onClick={() => {
                                setReviewingId(d.id)
                                setScreenshotChecked(false)
                              }}
                              className="text-xs bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              Review
                            </button>
                          )}

                          {d.receipt_data && d.status === 'verified' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => downloadReceipt(d.receipt_data!)}
                                className="text-xs bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-600 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                ↓ Receipt
                              </button>
                              <button
                                onClick={() => shareReceipt(d.receipt_data!)}
                                className="text-xs bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-600 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                Share
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isReviewing && (
                        <div className="border-t border-[#E8650A]/20 bg-[#F5EDE2]/50 dark:bg-gray-950/50 p-4 flex flex-col gap-4">
                          {d.screenshot_url ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-bold text-[#1A1208] dark:text-gray-300">Payment Screenshot</p>
                              <img
                                src={d.screenshot_url}
                                alt="Payment screenshot"
                                className="w-full max-w-xs rounded-xl border border-[#1A1208]/15 dark:border-gray-800 object-contain cursor-pointer shadow-xs"
                                onClick={() => setActiveScreenshot(d.screenshot_url)}
                              />
                              <a
                                href={d.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#E8650A] dark:text-blue-400 hover:underline font-bold"
                              >
                                Open full size ↗
                              </a>
                            </div>
                          ) : (
                            <div className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-3 text-center">
                              <p className="text-[#7a6a55] dark:text-gray-500 text-xs font-medium">No screenshot uploaded</p>
                            </div>
                          )}

                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                checked={screenshotChecked}
                                onChange={e => setScreenshotChecked(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                ${screenshotChecked ? 'bg-emerald-600 border-emerald-600' : 'border-[#1A1208]/30 dark:border-gray-500 bg-white dark:bg-gray-900 group-hover:border-[#E8650A]'}`}>
                                {screenshotChecked && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-[#1A1208] dark:text-gray-300 leading-relaxed font-medium">
                              I confirm receipt of <span className="text-[#1A1208] dark:text-white font-bold">{formatAmount(d.amount)}</span> from {d.donor_name}.
                            </span>
                          </label>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setRejectionModalId(d.id)}
                              className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-red-400 border border-rose-500/20 font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              ✗ Reject
                            </button>
                            {screenshotChecked && (
                              <button
                                onClick={() => verifyDonation(d.id)}
                                disabled={verifyingId === d.id}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs disabled:opacity-50 transition-colors cursor-pointer shadow-md"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-[#1A1208] dark:text-white">
              <h3 className="text-sm font-bold text-[#1A1208] dark:text-white mb-1">Reject Self-Donation</h3>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-3 font-medium">Provide a reason for rejection (visible to the mandal audit):</p>

              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Screenshot mismatch, payment not received, duplicate entry..."
                rows={3}
                className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg p-2.5 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 focus:outline-none focus:border-red-500 mb-4 resize-none font-medium"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setRejectionModalId(null)
                    setRejectionReason('')
                  }}
                  disabled={submittingRejection}
                  className="px-3 py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-[#1A1208] dark:text-white mb-4">Reset Password</h3>

              <div className="mb-4 space-y-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider">User:</label>
                  <p className="text-sm font-bold text-[#1A1208] dark:text-white">{resetPasswordUser.full_name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider">Role:</label>
                  <p className="text-xs font-bold text-[#7a6a55] dark:text-gray-300 capitalize">
                    {resetPasswordUser.role === 'manager' ? 'Khajindar (Manager)' : resetPasswordUser.role === 'collector' ? 'Sevak (Collector)' : resetPasswordUser.role}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-2">New Temporary Password:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={e => setTempPassword(e.target.value)}
                    placeholder="Enter password (min 8 chars)"
                    className="flex-1 bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A]"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="px-2.5 py-2 bg-[#ebdcc9] dark:bg-gray-800 hover:bg-[#dfcdb7] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-200 text-xs font-bold rounded-lg transition-colors border border-[#1A1208]/10 dark:border-gray-700 cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
                <div className="mt-3 space-y-1 bg-white/60 dark:bg-gray-950/45 border border-[#1A1208]/10 dark:border-gray-800/80 rounded-lg p-2.5">
                  <p className="text-[9px] text-[#7a6a55] dark:text-gray-500 font-bold mb-1.5 uppercase tracking-wider">Password Requirements:</p>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                      {tempPassword ? (passLength ? '✓' : '✗') : '•'} At least 8 characters
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passUpper ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                      {tempPassword ? (passUpper ? '✓' : '✗') : '•'} Uppercase letter (A-Z)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passLower ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                      {tempPassword ? (passLower ? '✓' : '✗') : '•'} Lowercase letter (a-z)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passNumber ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                      {tempPassword ? (passNumber ? '✓' : '✗') : '•'} A number (0-9)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] transition-colors">
                    <span className={tempPassword ? (passSpecial ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-red-400') : 'text-[#7a6a55] dark:text-gray-500'}>
                      {tempPassword ? (passSpecial ? '✓' : '✗') : '•'} Special character (e.g. #, @, $, !, %, &, *)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordUser(null)
                    setTempPassword('')
                  }}
                  disabled={resetPasswordSubmitting}
                  className="px-4 py-2.5 bg-[#ebdcc9] dark:bg-gray-800 hover:bg-[#dfcdb7] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={resetPasswordSubmitting || !isPasswordStrong}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
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
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-[#1A1208] dark:text-white mb-4">Edit Team Member</h3>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    placeholder="Enter phone number"
                    maxLength={10}
                    className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-3 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 font-medium focus:outline-none focus:border-[#E8650A]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['collector', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditRole(r)}
                        className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all cursor-pointer
                          ${editRole === r ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-950 border-[#1A1208]/15 dark:border-gray-800 text-[#7a6a55] dark:text-gray-400 hover:border-[#E8650A]'}`}
                      >
                        {r === 'collector' ? 'Sevak (Collector)' : 'Khajindar (Manager)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#7a6a55] dark:text-gray-400 tracking-wider mb-1.5">Event Access</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" onClick={() => setEditEventScope('all')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${editEventScope === 'all' ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-950 border-[#1A1208]/15 dark:border-gray-800 text-[#7a6a55] dark:text-gray-400 hover:border-[#E8650A]'}`}>
                      All events
                    </button>
                    <button type="button" onClick={() => setEditEventScope('specific')}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                        ${editEventScope === 'specific' ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md shadow-[#E8650A]/20' : 'bg-white dark:bg-gray-950 border-[#1A1208]/15 dark:border-gray-800 text-[#7a6a55] dark:text-gray-400 hover:border-[#E8650A]'}`}>
                      Specific event(s)
                    </button>
                  </div>
                  {editEventScope === 'specific' && (
                    events.length === 0 ? (
                      <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No events created yet.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg p-2.5">
                        {events.map(ev => (
                          <label key={ev.id} className="flex items-center gap-2 text-xs text-[#1A1208] dark:text-gray-300 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editEventIds.includes(ev.id)}
                              onChange={() => setEditEventIds(prev =>
                                prev.includes(ev.id) ? prev.filter(id => id !== ev.id) : [...prev, ev.id]
                              )}
                              className="accent-[#E8650A]"
                            />
                            {ev.name} <span className="text-[#7a6a55] dark:text-gray-500">({ev.year})</span>
                          </label>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  disabled={editSubmitting}
                  className="px-4 py-2.5 bg-[#ebdcc9] dark:bg-gray-800 hover:bg-[#dfcdb7] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={updateMember}
                  disabled={editSubmitting || !editName.trim() || editPhone.length !== 10}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E8650A]/20 cursor-pointer"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkVerifyModalCollector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-1">Settle Handover</h3>
              <p className="text-xs text-gray-400 mb-4">
                Verify received amounts for <strong>{bulkVerifyModalCollector.name}</strong>:
              </p>

              <div className="flex flex-col gap-3 mb-5">
                <button
                  onClick={() => {
                    settleCollector(bulkVerifyModalCollector.id, 'cash')
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-4 py-3 rounded-lg transition-colors cursor-pointer text-center shadow-md font-sans"
                >
                  Verify Cash Settlement ({formatAmount(bulkVerifyModalCollector.pendingCash)})
                </button>

                <button
                  onClick={() => {
                    settleCollector(bulkVerifyModalCollector.id, 'upi')
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-3 rounded-lg transition-colors cursor-pointer text-center shadow-md font-sans"
                >
                  Verify UPI Settlement ({formatAmount(bulkVerifyModalCollector.pendingUpi)})
                </button>
              </div>

              <div className="flex justify-end border-t border-gray-800 pt-3">
                <button
                  onClick={() => setBulkVerifyModalCollector(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors w-full sm:w-auto cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}