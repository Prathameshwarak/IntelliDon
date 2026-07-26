'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import UpiQR from '@/components/UpiQR'
import ThemeToggle from '@/components/ThemeToggle'
import { downloadReceipt, shareReceipt, type ReceiptData } from '@/lib/downloadReceipt'

type Event = {
  id: string
  name: string
  year: number
  upi_id: string | null
  upi_qr_url: string | null
}

type Mandal = {
  id: string
  name: string
  city: string
  address: string | null
  phone: string | null
}

type DuplicateWarning = {
  message: string
  previous_receipt: string
}

type SuccessData = {
  receipt_number: string
  donor_name: string
  amount: number
  payment_mode: string
  created_at: string
  status?: string
  receipt_data?: ReceiptData | null
  settlement_id?: string | null
}

type Step = 'form' | 'duplicate_warning' | 'cash_confirm' | 'upi_qr' | 'success'
type Tab = 'dashboard' | 'collect' | 'history'

export default function CollectPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [collectorName, setCollectorName] = useState('')
  const [mandal, setMandal] = useState<Mandal | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const [donorName, setDonorName] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [donorAddress, setDonorAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi_collector'>('cash')

  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [pendingPayload, setPendingPayload] = useState<any>(null)
  const [checkingPhone, setCheckingPhone] = useState(false)
  const [duplicateModalData, setDuplicateModalData] = useState<{ eventName: string; receiptId: string } | null>(null)

  // Dashboard & History States
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [donations, setDonations] = useState<any[]>([])
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [donationsError, setDonationsError] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all')
  const [historyModeFilter, setHistoryModeFilter] = useState('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function loadDonations(mId: string, uId: string) {
    setDonationsLoading(true)
    setDonationsError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}
      const res = await fetch(`/api/donations?mandal_id=${mId}&collected_by=${uId}`, { headers })
      const data = await res.json()
      if (data.error) {
        setDonationsError(data.error)
      } else {
        setDonations(data.donations || [])
      }
    } catch (err) {
      setDonationsError('Failed to load collections history')
    } finally {
      setDonationsLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!userRow || userRow.role !== 'collector') {
        if (userRow?.role === 'admin' || userRow?.role === 'manager') {
          router.push('/dashboard')
        } else if (userRow?.role === 'super_admin') {
          router.push('/super-admin')
        } else {
          router.push('/')
        }
        return
      }

      setUserId(user.id)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}

      const res = await fetch(`/api/collector?user_id=${user.id}`, { headers })
      const data = await res.json()

      if (data.error) { setError(data.error); setLoading(false); return }

      setCollectorName(data.user.full_name)
      setMandal(data.mandal)
      setEvents(data.events)
      if (data.events.length === 1) setSelectedEvent(data.events[0])

      // Initial loading of collections history
      await loadDonations(data.mandal.id, user.id)
      setLoading(false)
    }
    init()
  }, [router])

  // Automatically refresh collections on tab switches to ensure fresh statistics/history
  useEffect(() => {
    if (mandal?.id && userId && (activeTab === 'dashboard' || activeTab === 'history')) {
      loadDonations(mandal.id, userId)
    }
  }, [activeTab, mandal?.id, userId])

  async function submitDonation(payload: any) {
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.error) { setError(data.error); setSubmitting(false); return }

      setSuccessData(data.donation)

      // Reload donations list to update stats and history
      if (mandal?.id && userId) {
        loadDonations(mandal.id, userId)
      }

      if (data.duplicate_warning) {
        setDuplicateWarning(data.duplicate_warning)
        setStep('duplicate_warning')
      } else {
        setStep('success')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function buildProvisionalReceiptData(): ReceiptData | null {
    if (!successData || !mandal || !selectedEvent) return null
    const isVerified = successData.status === 'verified'
    return {
      receiptNumber: successData.receipt_number,
      mandalName: mandal.name,
      mandalAddress: [mandal.address, mandal.city].filter(Boolean).join(', '),
      mandalPhone: mandal.phone || '',
      eventName: `${selectedEvent.name} ${selectedEvent.year}`,
      donorName: successData.donor_name,
      donorPhone: donorPhone || '',
      donorAddress: donorAddress || null,
      amount: successData.amount,
      paymentMode: successData.payment_mode,
      createdAt: successData.created_at,
      collectedBy: collectorName || null,
      verified: isVerified,
      verifiedByRole: isVerified ? 'collector' : undefined,
      verifiedAt: isVerified ? successData.created_at : undefined
    }
  }

  async function handleFormSubmit() {
    setError('')
    if (!donorName.trim()) { setError('Enter donor name'); return }
    if (donorPhone.trim() && donorPhone.trim().length < 10) { setError('Enter valid 10-digit phone number'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Enter valid amount'); return }
    if (!selectedEvent) { setError('Select an event'); return }

    const payload = {
      mandal_id: mandal!.id,
      event_id: selectedEvent.id,
      donor_name: donorName,
      donor_phone: donorPhone,
      donor_address: donorAddress,
      amount: Number(amount),
      payment_mode: paymentMode,
      collected_by: userId
    }

    setPendingPayload(payload)

    // Check duplicate phone
    if (donorPhone.trim()) {
      setCheckingPhone(true)
      try {
        const res = await fetch(`/api/donations/check-phone?event_id=${selectedEvent.id}&phone=${donorPhone}`)
        const data = await res.json()
        if (data.exists) {
          setDuplicateModalData({
            eventName: data.event_name,
            receiptId: data.receipt_id
          })
          setCheckingPhone(false)
          return
        }
      } catch (err) {
        console.error('Failed to check duplicate phone', err)
      }
      setCheckingPhone(false)
    }

    proceedToPaymentStep(payload)
  }

  function proceedToPaymentStep(payload: any) {
    if (payload.payment_mode === 'cash') {
      setStep('cash_confirm')
    } else {
      setStep('upi_qr')
    }
  }

  function resetForm() {
    setDonorName('')
    setDonorPhone('')
    setDonorAddress('')
    setAmount('')
    setPaymentMode('cash')
    setDuplicateWarning(null)
    setPendingPayload(null)
    setSuccessData(null)
    setError('')
    setStep('form')
  }

  // Handle robust copy to clipboard (supporting iOS & Android safely)
  const handleCopyLink = async (url: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = url
        textArea.style.position = 'fixed'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  // CSV Export handler
  const handleExportCSV = (donationsToExport: any[], filename = 'collection_history.csv') => {
    const headers = ['Receipt Number', 'Donor Name', 'Phone', 'Address', 'Amount', 'Payment Mode', 'Status', 'Date']
    const rows = donationsToExport.map(d => [
      d.receipt_number,
      d.donor_name,
      d.donor_phone || '',
      d.donor_address || '',
      d.amount,
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
  const handleExportPDF = (donationsToExport: any[], title = 'Collection History Report') => {
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
            <div class="mandal">${mandal?.name || 'Intellidon Mandal'} · Generated on ${new Date().toLocaleDateString('en-IN')}</div>
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

  // Calculation for dashboard stats
  const totalCollected = donations.reduce((sum, d) => sum + Number(d.amount), 0)
  const verifiedAmount = donations.filter(d => d.status === 'verified').reduce((sum, d) => sum + Number(d.amount), 0)
  const pendingAmount = donations.filter(d => d.status === 'pending').reduce((sum, d) => sum + Number(d.amount), 0)
  const rejectedAmount = donations.filter(d => d.status === 'rejected').reduce((sum, d) => sum + Number(d.amount), 0)
  const totalDonors = donations.length

  const unsettledCash = donations
    .filter(d => d.status === 'verified' && d.payment_mode === 'cash' && !d.settlement_id)
    .reduce((sum, d) => sum + Number(d.amount), 0)

  const unsettledUpi = donations
    .filter(d => d.status === 'verified' && d.payment_mode === 'upi_collector' && !d.settlement_id)
    .reduce((sum, d) => sum + Number(d.amount), 0)

  const totalUnsettled = unsettledCash + unsettledUpi

  const cashAmount = donations.filter(d => d.payment_mode === 'cash').reduce((sum, d) => sum + Number(d.amount), 0)
  const upiAmount = donations.filter(d => d.payment_mode === 'upi_collector' || d.payment_mode === 'upi_self').reduce((sum, d) => sum + Number(d.amount), 0)

  // Temporal calculations (Daily, Weekly, Monthly)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  // Daily
  const todayDonations = donations.filter(d => new Date(d.created_at) >= todayStart)
  const todayTotal = todayDonations.reduce((sum, d) => sum + Number(d.amount), 0)

  const todayCashDonations = todayDonations.filter(d => d.payment_mode === 'cash')
  const todayCash = todayCashDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const todayCashCount = todayCashDonations.length

  const todayUpiDonations = todayDonations.filter(d => d.payment_mode === 'upi_collector' || d.payment_mode === 'upi_self')
  const todayUpi = todayUpiDonations.reduce((sum, d) => sum + Number(d.amount), 0)
  const todayUpiCount = todayUpiDonations.length

  // Weekly (Last 7 days)
  const weeklyDonations = donations.filter(d => new Date(d.created_at) >= sevenDaysAgo)
  const weeklyTotal = weeklyDonations.reduce((sum, d) => sum + Number(d.amount), 0)

  // Monthly (Last 30 days)
  const monthlyDonations = donations.filter(d => new Date(d.created_at) >= thirtyDaysAgo)
  const monthlyTotal = monthlyDonations.reduce((sum, d) => sum + Number(d.amount), 0)

  // Filter history donations
  const filteredDonations = donations.filter(d => {
    const q = historySearch.toLowerCase().trim()
    const matchesSearch = !q ||
      (d.donor_name && d.donor_name.toLowerCase().includes(q)) ||
      (d.donor_phone && d.donor_phone.toLowerCase().includes(q)) ||
      (d.receipt_number && d.receipt_number.toLowerCase().includes(q)) ||
      (d.amount && d.amount.toString().includes(q))

    const matchesStatus = historyStatusFilter === 'all' || d.status === historyStatusFilter

    let matchesMode = true
    if (historyModeFilter === 'cash') {
      matchesMode = d.payment_mode === 'cash'
    } else if (historyModeFilter === 'upi') {
      matchesMode = d.payment_mode === 'upi_collector' || d.payment_mode === 'upi_self'
    }

    return matchesSearch && matchesStatus && matchesMode
  })

  // Consistent loader panel
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#E8650A] border-r-transparent border-b-[#E8650A] border-l-transparent animate-spin" />
          <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Loading collector portal...</p>
        </div>
      </div>
    )
  }

  if (error && !mandal) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center px-4 transition-colors duration-300">
        <p className="text-rose-600 dark:text-red-400 text-sm text-center font-bold">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white pb-12 transition-colors duration-300">
      {/* Top Header (Matches Admin/Manager Dashboard style exactly) */}
      <div className="bg-[#F5EDE2] dark:bg-gray-900 border-b border-[#1A1208]/10 dark:border-gray-800 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold">Intellidon</p>
          <p className="text-sm sm:text-base font-bold truncate max-w-[160px] sm:max-w-none text-[#1A1208] dark:text-white">{mandal?.name}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-[#E8650A]/10 text-[#E8650A] dark:bg-orange-950/60 dark:text-orange-400 border border-[#E8650A]/20 capitalize">
            Collector ({collectorName})
          </span>
          <button
            onClick={() => router.push('/share')}
            className="text-[10px] sm:text-xs bg-white dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-white border border-[#1A1208]/10 dark:border-gray-700 font-bold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            🔗 <span className="hidden sm:inline">Share Link</span>
          </button>
          <ThemeToggle />
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-[10px] sm:text-xs text-rose-600 hover:text-rose-700 dark:text-red-400 dark:hover:text-red-300 font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-md mx-auto px-4 py-6">

        {/* Tab Navigation (Consistent styling with primary dashboard tab bar) */}
        <div className="flex gap-1 bg-[#F5EDE2] dark:bg-gray-900 rounded-xl p-1 border border-[#1A1208]/10 dark:border-gray-800 mb-6 w-full overflow-x-auto shadow-xs">
          {(['dashboard', 'collect', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap flex-shrink-0 flex-1 cursor-pointer
                ${activeTab === t
                  ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-md'
                  : 'text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white'}`}
            >
              {t === 'collect' ? '➕ Collect' : t === 'dashboard' ? '📊 Dashboard' : '📜 History'}
            </button>
          ))}
        </div>

        {/* ======================================================== */}
        {/* DASHBOARD TAB */}
        {/* ======================================================== */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div>
              <h1 className="text-xl font-bold text-[#1A1208] dark:text-white">Collector Dashboard</h1>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">Real-time overview of your collections</p>
            </div>

            {/* KPI Cards Grid (Matches Dashboard summary cards) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm h-28">
                <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider font-bold">Total Collected</span>
                <div className="mt-auto">
                  <span className="text-2xl font-extrabold text-[#1A1208] dark:text-white">₹{totalCollected.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mt-0.5 font-medium">{totalDonors} donations</span>
                </div>
              </div>

              <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm h-28">
                <span className="text-[10px] text-emerald-700 dark:text-green-400 uppercase tracking-wider font-bold">Verified</span>
                <div className="mt-auto">
                  <span className="text-2xl font-extrabold text-emerald-700 dark:text-green-400 font-sans">₹{verifiedAmount.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mt-0.5 font-medium">Approved by admin</span>
                </div>
              </div>

              <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm h-28">
                <span className="text-[10px] text-[#E8650A] dark:text-orange-400 uppercase tracking-wider font-bold">Today's Cash</span>
                <div className="mt-auto">
                  <span className="text-2xl font-extrabold text-[#1A1208] dark:text-white">{todayCashCount}</span>
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mt-0.5 font-medium">₹{todayCash.toLocaleString('en-IN')} collected</span>
                </div>
              </div>

              <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm h-28">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 uppercase tracking-wider font-bold">Today's UPI</span>
                <div className="mt-auto">
                  <span className="text-2xl font-extrabold text-[#1A1208] dark:text-white">{todayUpiCount}</span>
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mt-0.5 font-medium">₹{todayUpi.toLocaleString('en-IN')} collected</span>
                </div>
              </div>
            </div>

            {/* Daily, Weekly, Monthly Collections Card */}
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm animate-fade-in">
              <h3 className="text-xs font-bold text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider mb-4">Period Overview</h3>
              <div className="flex flex-col gap-3.5">
                {/* Daily */}
                <div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#7a6a55] dark:text-gray-300 font-bold">📅 Today's Collection</span>
                    <span className="font-extrabold text-[#1A1208] dark:text-white text-sm">₹{todayTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
                    <span className="flex items-center gap-1">💵 Cash: <strong className="text-[#1A1208] dark:text-gray-200 font-bold">₹{todayCash.toLocaleString('en-IN')}</strong></span>
                    <span className="flex items-center gap-1">📱 UPI: <strong className="text-[#1A1208] dark:text-gray-200 font-bold">₹{todayUpi.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>

                <div className="h-px bg-[#1A1208]/10 dark:bg-gray-800"></div>

                {/* Weekly */}
                <div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#7a6a55] dark:text-gray-300 font-bold">📅 Weekly Collection <span className="text-[9px] text-[#9e8c76] dark:text-gray-500 font-normal font-sans">(Last 7 days)</span></span>
                    <span className="font-extrabold text-[#1A1208] dark:text-white text-sm">₹{weeklyTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="h-px bg-[#1A1208]/10 dark:bg-gray-800"></div>

                {/* Monthly */}
                <div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#7a6a55] dark:text-gray-300 font-bold">📅 Monthly Collection <span className="text-[9px] text-[#9e8c76] dark:text-gray-500 font-normal font-sans">(Last 30 days)</span></span>
                    <span className="font-extrabold text-[#1A1208] dark:text-white text-sm">₹{monthlyTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Handover & Settlement Summary Card */}
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider">Handovers & Settlements</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${totalUnsettled > 0
                    ? 'bg-amber-500/10 text-amber-700 dark:text-yellow-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20'
                  }`}>
                  {totalUnsettled > 0 ? 'Pending Settlement' : '✓ Settled'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-center mt-2">
                <div className="bg-white dark:bg-gray-950/60 rounded-lg p-2.5 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block font-bold">Pending Cash</span>
                  <span className="text-sm font-extrabold text-[#1A1208] dark:text-white">₹{unsettledCash.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white dark:bg-gray-950/60 rounded-lg p-2.5 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block font-bold">Pending UPI</span>
                  <span className="text-sm font-extrabold text-[#1A1208] dark:text-white">₹{unsettledUpi.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white dark:bg-gray-950/60 rounded-lg p-2.5 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                  <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 block font-bold font-sans">Unsettled Total</span>
                  <span className="text-sm font-extrabold text-[#E8650A] dark:text-orange-400">₹{totalUnsettled.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Payment Mode Breakdown */}
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider mb-4">Collection Modes</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-[#7a6a55] dark:text-gray-300 font-bold">💵 Cash Collections</span>
                    <span className="font-extrabold text-[#1A1208] dark:text-white">₹{cashAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-white dark:bg-gray-950 h-2.5 rounded-full overflow-hidden border border-[#1A1208]/10 dark:border-gray-800">
                    <div
                      className="bg-gradient-to-r from-[#E8650A] to-[#f97316] h-full rounded-full transition-all duration-500"
                      style={{ width: `${totalCollected > 0 ? (cashAmount / totalCollected) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-[#7a6a55] dark:text-gray-300 font-bold">📱 UPI QR Collections</span>
                    <span className="font-extrabold text-[#1A1208] dark:text-white">₹{upiAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-white dark:bg-gray-950 h-2.5 rounded-full overflow-hidden border border-[#1A1208]/10 dark:border-gray-800">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${totalCollected > 0 ? (upiAmount / totalCollected) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Collections */}
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-[#7a6a55] dark:text-gray-400 uppercase tracking-wider">Recent Activity</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold transition-colors cursor-pointer"
                >
                  View All →
                </button>
              </div>

              {donationsLoading ? (
                <div className="text-center py-6">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Loading activity...</p>
                </div>
              ) : donations.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">No collections recorded yet</p>
                  <button
                    onClick={() => setActiveTab('collect')}
                    className="mt-3 bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    Record First Donation
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {donations.slice(0, 3).map((d, index) => (
                    <div
                      key={d.id}
                      className={`py-3 flex justify-between items-center ${index !== 2 && index !== donations.length - 1 ? 'border-b border-[#1A1208]/10 dark:border-gray-800' : ''
                        }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-[#1A1208] dark:text-white">{d.donor_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#9e8c76] dark:text-gray-400 font-mono">{d.receipt_number}</span>
                          <span className="text-[10px] text-[#7a6a55] dark:text-gray-500">•</span>
                          <span className="text-[10px] text-[#7a6a55] dark:text-gray-400 font-medium">
                            {d.payment_mode === 'cash' ? '💵 Cash' : '📱 UPI'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-sm font-extrabold text-[#1A1208] dark:text-white">₹{Number(d.amount).toLocaleString('en-IN')}</p>
                        <div className="flex gap-1 items-center">
                          <span
                            className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide
                              ${d.status === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20'
                                : d.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-yellow-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-red-400 border-rose-500/20'
                              }`}
                          >
                            {d.status}
                          </span>
                          {d.status === 'verified' && (
                            <span
                              className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide
                                ${d.settlement_id
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-yellow-400 border-amber-500/20'
                                }`}
                            >
                              {d.settlement_id ? '✓ Settled' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* COLLECT TAB */}
        {/* ======================================================== */}
        {activeTab === 'collect' && (
          <div className="animate-fade-in">
            {/* STEP: Form */}
            {step === 'form' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h1 className="text-lg font-bold text-[#1A1208] dark:text-white">New Donation</h1>
                  <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">Enter donor details below</p>
                </div>

                {events.length > 1 && (
                  <div>
                    <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Event</label>
                    <select
                      value={selectedEvent?.id || ''}
                      onChange={e => setSelectedEvent(events.find(ev => ev.id === e.target.value) || null)}
                      className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-3 text-sm text-[#1A1208] dark:text-white font-medium focus:outline-none focus:border-[#E8650A]"
                    >
                      <option value="" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">Select event</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id} className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">{ev.name} {ev.year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedEvent && events.length === 1 && (
                  <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-medium">Event</p>
                    <p className="text-sm font-bold text-[#1A1208] dark:text-white">{selectedEvent.name} {selectedEvent.year}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Donor Name *</label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={e => setDonorName(e.target.value)}
                    placeholder="Full name"
                    className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-3 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">
                    Phone Number <span className="text-[#9e8c76] dark:text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={donorPhone}
                    onChange={e => setDonorPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-3 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Address <span className="text-[#9e8c76] dark:text-gray-500 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={donorAddress}
                    onChange={e => setDonorAddress(e.target.value)}
                    placeholder="Flat / Building / Area"
                    className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-3 text-sm text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 block font-bold">Amount (₹) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-700 rounded-lg px-3 py-3 text-2xl font-extrabold text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-600 focus:outline-none focus:border-[#E8650A]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#7a6a55] dark:text-gray-400 mb-2 block font-bold">Payment Mode *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMode('cash')}
                      className={`py-3 rounded-lg text-sm font-bold border transition-colors cursor-pointer
                        ${paymentMode === 'cash'
                          ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md'
                          : 'bg-white dark:bg-gray-900 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400'}`}
                    >
                      💵 Cash
                    </button>
                    <button
                      onClick={() => setPaymentMode('upi_collector')}
                      className={`py-3 rounded-lg text-sm font-bold border transition-colors cursor-pointer
                        ${paymentMode === 'upi_collector'
                          ? 'bg-gradient-to-r from-[#E8650A] to-[#f97316] border-[#E8650A] text-white shadow-md'
                          : 'bg-white dark:bg-gray-900 border-[#1A1208]/15 dark:border-gray-700 text-[#7a6a55] dark:text-gray-400'}`}
                    >
                      📱 UPI / QR
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    <p className="text-rose-700 dark:text-red-400 text-sm font-bold">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleFormSubmit}
                  disabled={submitting || checkingPhone}
                  className="w-full bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-all mt-2 cursor-pointer shadow-md"
                >
                  {checkingPhone ? 'Checking details...' : 'Continue →'}
                </button>
              </div>
            )}

            {/* STEP: Cash Confirm */}
            {step === 'cash_confirm' && (
              <div className="flex flex-col gap-4">
                <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-5 text-center shadow-sm">
                  <p className="text-4xl mb-3">💵</p>
                  <p className="text-[#7a6a55] dark:text-gray-400 text-xs mb-1 font-bold">Confirm cash collected from</p>
                  <p className="text-[#1A1208] dark:text-white font-bold text-xl">{donorName}</p>
                  <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-medium">{donorPhone}</p>
                  {donorAddress && <p className="text-[#9e8c76] dark:text-gray-500 text-xs mt-1">{donorAddress}</p>}
                  <div className="mt-5 bg-white dark:bg-gray-950 rounded-lg py-4 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                    <p className="text-[#7a6a55] dark:text-gray-400 text-xs mb-1 font-bold">Amount</p>
                    <p className="text-4xl font-extrabold text-[#1A1208] dark:text-white">₹{Number(amount).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    <p className="text-rose-700 dark:text-red-400 text-sm font-bold">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => submitDonation(pendingPayload)}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-md cursor-pointer"
                >
                  {submitting ? 'Recording...' : '✓ Confirm Collection & Record Donation'}
                </button>

                <button onClick={() => setStep('form')} className="w-full bg-white dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold py-3 rounded-xl text-sm transition-colors border border-[#1A1208]/10 dark:border-gray-700 cursor-pointer">
                  ← Go Back
                </button>
              </div>
            )}

            {/* STEP: UPI QR */}
            {step === 'upi_qr' && selectedEvent && (
              <div className="flex flex-col gap-4">
                <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-5 flex flex-col items-center gap-4 shadow-sm">
                  <p className="text-[#7a6a55] dark:text-gray-300 text-xs font-bold">Show this QR to the donor</p>

                  {selectedEvent.upi_id ? (
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <UpiQR
                        upiId={selectedEvent.upi_id}
                        name={mandal?.name || ''}
                        amount={Number(amount)}
                        note={`${selectedEvent.name} ${selectedEvent.year} Donation`}
                        size={220}
                      />
                    </div>
                  ) : (
                    <div className="w-52 h-52 bg-white dark:bg-gray-950 rounded-xl flex items-center justify-center border border-[#1A1208]/10 dark:border-gray-800">
                      <div className="text-center px-4">
                        <p className="text-[#7a6a55] dark:text-gray-400 text-xs mb-2 font-bold">No UPI ID set</p>
                        <p className="text-[#9e8c76] dark:text-gray-500 text-xs font-medium">Ask admin to add UPI ID in Events settings</p>
                      </div>
                    </div>
                  )}

                  <p className="text-[#7a6a55] dark:text-gray-400 text-xs text-center max-w-xs leading-relaxed font-medium">
                    Once the donor scans and pays, tap the button below to record the donation
                  </p>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    <p className="text-rose-700 dark:text-red-400 text-sm font-bold">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => submitDonation(pendingPayload)}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base shadow-md cursor-pointer"
                >
                  {submitting ? 'Recording...' : '✓ Payment Done — Record Donation'}
                </button>

                <button onClick={() => setStep('form')} className="w-full bg-white dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold py-3 rounded-xl text-sm transition-colors border border-[#1A1208]/10 dark:border-gray-700 cursor-pointer">
                  ← Go Back
                </button>
              </div>
            )}

            {/* STEP: Duplicate Warning */}
            {step === 'duplicate_warning' && duplicateWarning && successData && (
              <div className="flex flex-col gap-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-amber-800 dark:text-yellow-400 font-bold text-sm mb-1">⚠ Already donated this event</p>
                  <p className="text-amber-900/80 dark:text-yellow-300/80 text-xs leading-relaxed font-medium">{duplicateWarning.message}</p>
                  <p className="text-amber-900/70 dark:text-yellow-300/60 text-xs mt-2 font-medium">Previous receipt: <span className="font-mono font-bold">{duplicateWarning.previous_receipt}</span></p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-800 dark:text-green-400 font-bold text-sm mb-2">New donation recorded</p>
                  <p className="text-xs text-[#1A1208] dark:text-gray-300 font-medium">Receipt: <span className="font-mono font-bold">{successData.receipt_number}</span></p>
                  <p className="text-xs text-[#1A1208] dark:text-gray-300 mt-1 font-medium">Amount: ₹{Number(successData.amount).toLocaleString('en-IN')}</p>
                </div>
                <button onClick={resetForm} className="w-full bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white font-bold py-4 rounded-xl shadow-md cursor-pointer">
                  + Next Donation
                </button>
              </div>
            )}

            {/* STEP: Success */}
            {step === 'success' && successData && (
              <div className="flex flex-col gap-4 text-center">
                <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-6 shadow-sm">

                  {/* Success icon */}
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xs">
                    <span className="text-emerald-700 dark:text-green-400 text-2xl font-bold">✓</span>
                  </div>

                  {successData.status === 'verified' && (
                    <div className="mb-3 inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                      🟢 VERIFIED &bull; Verified by Collector
                    </div>
                  )}

                  <p className="text-emerald-700 dark:text-green-400 font-extrabold text-xl mb-1">Donation Recorded!</p>
                  <p className="text-[#7a6a55] dark:text-gray-300 text-sm font-bold">{successData.donor_name}</p>

                  {/* Receipt number */}
                  <div className="mt-5 bg-white dark:bg-gray-950 rounded-lg py-3 px-4 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                    <p className="text-[#7a6a55] dark:text-gray-400 text-xs mb-1 font-bold">Receipt Number</p>
                    <p className="text-[#1A1208] dark:text-white font-mono font-extrabold text-xl tracking-wide">
                      {successData.receipt_number}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="mt-2 bg-white dark:bg-gray-950 rounded-lg py-3 px-4 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                    <p className="text-[#7a6a55] dark:text-gray-400 text-xs mb-1 font-bold">Amount</p>
                    <p className="text-[#1A1208] dark:text-white font-extrabold text-3xl">
                      ₹{Number(successData.amount).toLocaleString('en-IN')}
                    </p>
                  </div>

                  {/* Payment mode */}
                  <div className="mt-2 bg-white dark:bg-gray-950 rounded-lg py-2 px-4 border border-[#1A1208]/10 dark:border-gray-800 shadow-xs">
                    <p className="text-[#7a6a55] dark:text-gray-300 text-xs font-bold">
                      {successData.payment_mode === 'cash' ? '💵 Cash' : '📱 UPI'}
                    </p>
                  </div>
                </div>

                {/* Receipt links & actions */}
                {successData.receipt_data || buildProvisionalReceiptData() ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => downloadReceipt(successData.receipt_data || buildProvisionalReceiptData()!)}
                      className="w-full flex items-center justify-center gap-2 bg-[#E8650A] hover:bg-[#d05807] text-white
                        font-bold py-4 rounded-xl text-base transition-colors shadow-md cursor-pointer"
                    >
                      <span>↓</span>
                      <span>Download Receipt</span>
                    </button>
                    <button
                      onClick={() => shareReceipt(successData.receipt_data || buildProvisionalReceiptData()!)}
                      className="w-full py-4 text-base font-bold rounded-xl transition-all shadow-sm border bg-white dark:bg-gray-800 text-[#1A1208] dark:text-white border-[#1A1208]/10 dark:border-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 cursor-pointer"
                    >
                      Share Receipt
                    </button>
                    {successData.status === 'verified' ? (
                      <p className="text-xs text-emerald-700 dark:text-green-500 font-bold">🟢 VERIFIED - Verified by Collector</p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-yellow-500 font-bold">Pending verification</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl px-4 py-3 text-center">
                    <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-medium">Receipt PDF unavailable right now.</p>
                    <p className="text-[#9e8c76] dark:text-gray-500 text-xs mt-1 font-medium">
                      Share receipt number <span className="font-mono text-[#1A1208] dark:text-white font-bold">{successData.receipt_number}</span> with the donor.
                    </p>
                  </div>
                )}

                <p className="text-[#7a6a55] dark:text-gray-500 text-xs px-4 leading-relaxed font-medium">
                  Share the receipt download link directly on WhatsApp or copy it to send manually.
                </p>

                <button
                  onClick={resetForm}
                  className="w-full bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white font-bold py-4 rounded-xl text-base transition-colors shadow-md cursor-pointer"
                >
                  + Next Donation
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* HISTORY TAB */}
        {/* ======================================================== */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h1 className="text-xl font-bold text-[#1A1208] dark:text-white">Collection History</h1>
              <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">Search, filter, and share receipt links</p>
            </div>

            {/* Search & Filters block (Matches dashboard input layouts) */}
            <div className="flex flex-col gap-2.5 bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-3.5 shadow-sm">
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#7a6a55] dark:text-gray-500 text-xs">🔍</span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search by donor name, phone, amount, or receipt..."
                  className="w-full bg-white dark:bg-gray-950 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg pl-8 pr-8 py-2 text-xs text-[#1A1208] dark:text-white placeholder-[#9e8c76] dark:placeholder-gray-500 focus:outline-none focus:border-[#E8650A] transition-colors font-medium"
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    className="absolute right-3 top-2 text-[#7a6a55] dark:text-gray-500 hover:text-[#1A1208] dark:hover:text-white text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mb-1 uppercase font-bold tracking-wider">Status</label>
                  <select
                    value={historyStatusFilter}
                    onChange={e => setHistoryStatusFilter(e.target.value)}
                    className="w-full bg-white dark:bg-gray-955 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs text-[#1A1208] dark:text-gray-200 focus:outline-none focus:border-[#E8650A] transition-colors font-medium"
                  >
                    <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Statuses</option>
                    <option value="pending" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">⏳ Pending</option>
                    <option value="verified" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">✅ Verified</option>
                    <option value="rejected" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">❌ Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#7a6a55] dark:text-gray-400 block mb-1 uppercase font-bold tracking-wider">Payment Mode</label>
                  <select
                    value={historyModeFilter}
                    onChange={e => setHistoryModeFilter(e.target.value)}
                    className="w-full bg-white dark:bg-gray-955 border border-[#1A1208]/15 dark:border-gray-800 rounded-lg px-2.5 py-2 text-xs text-[#1A1208] dark:text-gray-200 focus:outline-none focus:border-[#E8650A] transition-colors font-medium"
                  >
                    <option value="all" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">All Modes</option>
                    <option value="cash" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">💵 Cash</option>
                    <option value="upi" className="bg-white dark:bg-gray-900 text-[#1A1208] dark:text-white">📱 UPI QR</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExportCSV(filteredDonations, `my_history_${new Date().toISOString().slice(0, 10)}.csv`)}
                disabled={filteredDonations.length === 0}
                className="flex-1 py-2 bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => handleExportPDF(filteredDonations, 'My Collections History Report')}
                disabled={filteredDonations.length === 0}
                className="flex-1 py-2 bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-xs hover:bg-[#ebdcc9] dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                📄 Export PDF
              </button>
            </div>

            {/* List */}
            {donationsLoading ? (
              <div className="text-center py-10">
                <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">Loading collections history...</p>
              </div>
            ) : donationsError ? (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center shadow-sm">
                <p className="text-rose-700 dark:text-red-400 text-xs font-bold">{donationsError}</p>
                <button
                  onClick={() => mandal && userId && loadDonations(mandal.id, userId)}
                  className="mt-2 text-xs text-[#E8650A] dark:text-orange-400 hover:underline font-bold transition-colors cursor-pointer"
                >
                  Tap to retry
                </button>
              </div>
            ) : filteredDonations.length === 0 ? (
              <div className="text-center py-12 bg-white/60 dark:bg-gray-900/30 border border-dashed border-[#1A1208]/15 dark:border-gray-800 rounded-xl">
                <p className="text-xs text-[#7a6a55] dark:text-gray-500 font-medium">No collections found matching filters</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredDonations.map(d => (
                  <div
                    key={d.id}
                    className="bg-white dark:bg-gray-900 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-[#E8650A] shadow-sm"
                  >
                    {/* Top Row: Donor & Amount */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-[#1A1208] dark:text-white leading-snug">{d.donor_name}</h4>
                        <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-0.5 font-medium">{d.donor_phone || 'No phone number'}</p>
                        {d.donor_address && (
                          <p className="text-[11px] text-[#9e8c76] dark:text-gray-500 mt-1 italic leading-relaxed font-medium">{d.donor_address}</p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-base font-extrabold text-[#1A1208] dark:text-white">₹{Number(d.amount).toLocaleString('en-IN')}</span>
                        <div className="mt-1 flex flex-col items-end gap-1">
                          <span
                            className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide
                              ${d.status === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20'
                                : d.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-yellow-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-red-400 border-rose-500/20'
                              }`}
                          >
                            {d.status}
                          </span>
                          {d.status === 'verified' && (
                            <span
                              className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide
                                ${d.settlement_id
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-green-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-yellow-400 border-amber-500/20'
                                }`}
                            >
                              {d.settlement_id ? '✓ Settled' : 'Pending Settlement'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#1A1208]/10 dark:bg-gray-800"></div>

                    {/* Bottom Row: Date, Mode, Receipt Number */}
                    <div className="flex justify-between items-end text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#7a6a55] dark:text-gray-400 font-bold">Receipt:</span>
                          <span className="font-mono font-bold text-[#1A1208] dark:text-gray-300">{d.receipt_number}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[#9e8c76] dark:text-gray-500 text-[10px] font-medium">
                          <span>
                            {new Date(d.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span>•</span>
                          <span>{d.payment_mode === 'cash' ? '💵 Cash' : '📱 UPI'}</span>
                        </div>
                      </div>

                      {/* PDF actions */}
                      {d.receipt_data ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => downloadReceipt(d.receipt_data)}
                            className="px-2.5 py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-[11px] transition-colors border border-[#1A1208]/10 dark:border-gray-700 cursor-pointer"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => shareReceipt(d.receipt_data)}
                            className="px-2.5 py-1.5 bg-[#F5EDE2] dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 font-bold rounded-lg text-[11px] transition-colors border border-[#1A1208]/10 dark:border-gray-700 cursor-pointer"
                          >
                            Share
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-700 dark:text-yellow-500 font-bold italic">Pending verification</span>
                      )}
                    </div>

                    {d.status === 'rejected' && d.rejection_reason && (
                      <div className="bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 dark:border-rose-900/40 rounded-lg px-2.5 py-1.5 mt-0.5">
                        <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-bold">Rejection Reason: {d.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* DUPLICATE PHONE MODAL */}
        {/* ======================================================== */}
        {duplicateModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-[#F5EDE2] dark:bg-gray-900 border border-[#1A1208]/15 dark:border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center text-[#1A1208] dark:text-white">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-yellow-500 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto border border-amber-500/20">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-[#1A1208] dark:text-white mb-2">Previous Donation Found</h3>
              <p className="text-sm text-[#7a6a55] dark:text-gray-400 leading-relaxed mb-4 font-medium">
                A donation for <strong className="text-[#1A1208] dark:text-white font-bold">{duplicateModalData.eventName}</strong> has been done previously with this phone number.
              </p>
              <div className="bg-white dark:bg-gray-950 border border-[#1A1208]/10 dark:border-gray-800 rounded-xl p-3 mb-6">
                <span className="text-[10px] text-[#7a6a55] dark:text-gray-500 block font-bold uppercase tracking-wider">Receipt ID</span>
                <span className="text-sm font-mono font-extrabold text-[#1A1208] dark:text-gray-300">{duplicateModalData.receiptId}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDuplicateModalData(null)}
                  className="flex-1 bg-white dark:bg-gray-800 hover:bg-[#ebdcc9] dark:hover:bg-gray-700 text-[#1A1208] dark:text-gray-300 border border-[#1A1208]/10 dark:border-gray-700 font-bold py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    setDuplicateModalData(null)
                    if (pendingPayload) {
                      proceedToPaymentStep(pendingPayload)
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white font-bold py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer shadow-md"
                >
                  I know, continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}