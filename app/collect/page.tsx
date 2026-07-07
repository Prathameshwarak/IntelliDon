'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import UpiQR from '@/components/UpiQR'

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
  pdf_url: string | null
}

type Step = 'form' | 'duplicate_warning' | 'cash_confirm' | 'upi_qr' | 'success'

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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!userRow || !['collector', 'admin', 'manager'].includes(userRow.role)) {
        router.push('/')
        return
      }

      setUserId(user.id)

      const res = await fetch(`/api/collector?user_id=${user.id}`)
      const data = await res.json()

      if (data.error) { setError(data.error); setLoading(false); return }

      setCollectorName(data.user.full_name)
      setMandal(data.mandal)
      setEvents(data.events)
      if (data.events.length === 1) setSelectedEvent(data.events[0])
      setLoading(false)
    }
    init()
  }, [router])

  async function submitDonation(payload: any) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.error) { setError(data.error); setSubmitting(false); return }

      setSuccessData(data.donation)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (error && !mandal) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Intellidon</p>
          <p className="text-sm font-medium">{mandal?.name}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-xs text-gray-400">{collectorName}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/share')}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              🔗 Share
            </button>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">

        {/* STEP: Form */}
        {step === 'form' && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-semibold">New Donation</h1>
              <p className="text-xs text-gray-400 mt-0.5">Enter donor details below</p>
            </div>

            {events.length > 1 && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Event</label>
                <select
                  value={selectedEvent?.id || ''}
                  onChange={e => setSelectedEvent(events.find(ev => ev.id === e.target.value) || null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white"
                >
                  <option value="">Select event</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name} {ev.year}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedEvent && events.length === 1 && (
              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">Event</p>
                <p className="text-sm font-medium">{selectedEvent.name} {selectedEvent.year}</p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Donor Name *</label>
              <input
                type="text"
                value={donorName}
                onChange={e => setDonorName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-450 mb-1 block">
                Phone Number <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={donorPhone}
                onChange={e => setDonorPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Address <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={donorAddress}
                onChange={e => setDonorAddress(e.target.value)}
                placeholder="Flat / Building / Area"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Amount (₹) *</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-2xl font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Payment Mode *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMode('cash')}
                  className={`py-3 rounded-lg text-sm font-medium border transition-colors
                    ${paymentMode === 'cash'
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMode('upi_collector')}
                  className={`py-3 rounded-lg text-sm font-medium border transition-colors
                    ${paymentMode === 'upi_collector'
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  📱 UPI / QR
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleFormSubmit}
              disabled={submitting || checkingPhone}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl text-base transition-colors mt-2 cursor-pointer"
            >
              {checkingPhone ? 'Checking details...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* STEP: Cash Confirm */}
        {step === 'cash_confirm' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-xl p-5 text-center">
              <p className="text-4xl mb-3">💵</p>
              <p className="text-gray-400 text-sm mb-1">Confirm cash collected from</p>
              <p className="text-white font-semibold text-xl">{donorName}</p>
              <p className="text-gray-400 text-sm">{donorPhone}</p>
              {donorAddress && <p className="text-gray-500 text-xs mt-1">{donorAddress}</p>}
              <div className="mt-5 bg-gray-900 rounded-lg py-4">
                <p className="text-gray-400 text-xs mb-1">Amount</p>
                <p className="text-4xl font-bold text-white">₹{Number(amount).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={() => submitDonation(pendingPayload)}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-base transition-colors"
            >
              {submitting ? 'Recording...' : '✓ Cash Collected — Record Donation'}
            </button>

            <button onClick={() => setStep('form')} className="w-full bg-gray-800 text-gray-400 font-medium py-3 rounded-xl text-sm">
              ← Go Back
            </button>
          </div>
        )}

        {/* STEP: UPI QR */}
        {step === 'upi_qr' && selectedEvent && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-xl p-5 flex flex-col items-center gap-4">
              <p className="text-gray-400 text-sm">Show this QR to the donor</p>

              {selectedEvent.upi_id ? (
                // Dynamic QR with amount encoded — donor cannot change amount
                <UpiQR
                  upiId={selectedEvent.upi_id}
                  name={mandal?.name || ''}
                  amount={Number(amount)}
                  note={`${selectedEvent.name} ${selectedEvent.year} Donation`}
                  size={220}
                />
              ) : (
                // No UPI ID set — show message to admin
                <div className="w-52 h-52 bg-gray-900 rounded-xl flex items-center justify-center border border-gray-700">
                  <div className="text-center px-4">
                    <p className="text-gray-500 text-xs mb-2">No UPI ID set</p>
                    <p className="text-gray-400 text-xs">Ask admin to add UPI ID in Events settings</p>
                  </div>
                </div>
              )}

              <p className="text-gray-500 text-xs text-center max-w-xs">
                Once the donor scans and pays, tap the button below to record the donation
              </p>
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={() => submitDonation(pendingPayload)}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-base"
            >
              {submitting ? 'Recording...' : '✓ Payment Done — Record Donation'}
            </button>

            <button onClick={() => setStep('form')} className="w-full bg-gray-800 text-gray-400 font-medium py-3 rounded-xl text-sm">
              ← Go Back
            </button>
          </div>
        )}

        {/* STEP: Duplicate Warning */}
        {step === 'duplicate_warning' && duplicateWarning && successData && (
          <div className="flex flex-col gap-4">
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
              <p className="text-yellow-400 font-semibold text-sm mb-1">⚠ Already donated this event</p>
              <p className="text-yellow-300/80 text-xs leading-relaxed">{duplicateWarning.message}</p>
              <p className="text-yellow-300/60 text-xs mt-2">Previous receipt: <span className="font-mono font-medium">{duplicateWarning.previous_receipt}</span></p>
            </div>
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
              <p className="text-green-400 font-semibold text-sm mb-2">New donation recorded</p>
              <p className="text-xs text-gray-300">Receipt: <span className="font-mono font-semibold">{successData.receipt_number}</span></p>
              <p className="text-xs text-gray-300 mt-1">Amount: ₹{Number(successData.amount).toLocaleString('en-IN')}</p>
            </div>
            <button onClick={resetForm} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-xl">
              + Next Donation
            </button>
          </div>
        )}

        {/* STEP: Success */}
        {step === 'success' && successData && (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-gray-800 rounded-xl p-6">

              {/* Success icon */}
              <div className="w-16 h-16 bg-green-900/50 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-2xl font-bold">✓</span>
              </div>

              <p className="text-green-400 font-semibold text-xl mb-1">Donation Recorded!</p>
              <p className="text-gray-400 text-sm">{successData.donor_name}</p>

              {/* Receipt number */}
              <div className="mt-5 bg-gray-900 rounded-lg py-3 px-4">
                <p className="text-gray-500 text-xs mb-1">Receipt Number</p>
                <p className="text-white font-mono font-bold text-xl tracking-wide">
                  {successData.receipt_number}
                </p>
              </div>

              {/* Amount */}
              <div className="mt-2 bg-gray-900 rounded-lg py-3 px-4">
                <p className="text-gray-500 text-xs mb-1">Amount</p>
                <p className="text-white font-bold text-3xl">
                  ₹{Number(successData.amount).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Payment mode */}
              <div className="mt-2 bg-gray-900 rounded-lg py-2 px-4">
                <p className="text-gray-500 text-xs">
                  {successData.payment_mode === 'cash' ? '💵 Cash' : '📱 UPI'}
                </p>
              </div>
            </div>

            {/* Receipt download — shown immediately if PDF was generated */}
            {successData.pdf_url ? (
              <a
                href={successData.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-white text-gray-900
                  font-semibold py-4 rounded-xl text-base transition-colors hover:bg-gray-100"
              >
                <span>↓</span>
                <span>Download Receipt</span>
              </a>
            ) : (
              // PDF generation failed silently — show receipt number as fallback
              <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center">
                <p className="text-gray-400 text-xs">Receipt PDF unavailable right now.</p>
                <p className="text-gray-500 text-xs mt-1">
                  Share receipt number <span className="font-mono text-white">{successData.receipt_number}</span> with the donor.
                </p>
              </div>
            )}

            <p className="text-gray-600 text-xs px-4">
              Share the download link with the donor via WhatsApp or show them the receipt number.
            </p>

            <button
              onClick={resetForm}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-xl text-base transition-colors"
            >
              + Next Donation
            </button>
          </div>
        )}

        {duplicateModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
              <div className="w-12 h-12 bg-yellow-950/50 text-yellow-500 rounded-full flex items-center justify-center text-2xl mb-4 mx-auto border border-yellow-900/30">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Previous Donation Found</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                A donation for <strong className="text-white">{duplicateModalData.eventName}</strong> has been done previously with this phone number.
              </p>
              <div className="bg-gray-950 border border-gray-850 rounded-xl p-3 mb-6">
                <span className="text-[10px] text-gray-500 block font-medium uppercase tracking-wider">Receipt ID</span>
                <span className="text-sm font-mono font-bold text-gray-300">{duplicateModalData.receiptId}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDuplicateModalData(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer"
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer"
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