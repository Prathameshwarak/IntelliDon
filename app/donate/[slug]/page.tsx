'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import UpiQR from '@/components/UpiQR'

type MandalInfo = {
  id: string
  name: string
  city: string
  address: string
}

type EventInfo = {
  id: string
  name: string
  year: number
  upi_id: string | null
  upi_qr_url: string | null
}

type Step = 'form' | 'payment' | 'screenshot' | 'success' | 'error'

export default function PublicDonatePage() {
  const { slug } = useParams() as { slug: string }

  // Mandal + event info
  const [mandal, setMandal] = useState<MandalInfo | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Form state
  const [donorName, setDonorName] = useState('')
  const [donorPhone, setDonorPhone] = useState('')
  const [donorAddress, setDonorAddress] = useState('')
  const [amount, setAmount] = useState('')

  // Screenshot upload
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // UI state
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [donationId, setDonationId] = useState('')

  // ── Load mandal + event on mount ──────────────────────────────
  useEffect(() => {
    async function loadMandal() {
      try {
        const res = await fetch(`/api/donate?slug=${slug}`)
        const data = await res.json()

        if (data.error) {
          setPageError(data.error)
          setStep('error')
        } else {
          setMandal(data.mandal)
          setEvent(data.event)
        }
      } catch {
        setPageError('Could not load this page. Check your link.')
        setStep('error')
      } finally {
        setPageLoading(false)
      }
    }
    if (slug) loadMandal()
  }, [slug])

  // ── Handle screenshot file pick ───────────────────────────────
  function handleScreenshotPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Max 5MB.')
      return
    }
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
    setError('')
  }

  // ── Validate form and move to payment step ────────────────────
  function handleFormSubmit() {
    setError('')
    if (!donorName.trim()) { setError('Enter your full name'); return }
    if (!donorPhone.trim() || donorPhone.length < 10) { setError('Enter valid 10-digit phone number'); return }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Enter a valid donation amount'); return }
    setStep('payment')
  }

  // ── Upload screenshot to Supabase storage ─────────────────────
  async function uploadScreenshot(file: File): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mandal_id', mandal!.id)

      const res = await fetch('/api/donate/upload-screenshot', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }

  // ── Submit donation after screenshot upload ───────────────────
  async function handleSubmitDonation() {
    setError('')
    if (!screenshot) { setError('Please upload a screenshot of your payment'); return }

    setSubmitting(true)
    try {
      // Upload screenshot first
      const screenshotUrl = await uploadScreenshot(screenshot)

      // Submit donation
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandal_id: mandal!.id,
          event_id: event!.id,
          donor_name: donorName,
          donor_phone: donorPhone,
          donor_address: donorAddress,
          amount: Number(amount),
          payment_mode: 'upi_self',
          collected_by: null,
          screenshot_url: screenshotUrl
        })
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setReceiptNumber(data.donation.receipt_number)
      setDonationId(data.donation.id)
      setStep('success')

    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // ── Error page ────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">✕</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link not valid</h1>
          <p className="text-gray-500 text-sm">{pageError}</p>
          <p className="text-gray-400 text-xs mt-4">
            Contact the organisation for the correct donation link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-500 font-semibold tracking-wide">INTELLIDON</p>
            <p className="text-base font-semibold text-gray-900">{mandal?.name}</p>
            {mandal?.city && <p className="text-xs text-gray-400">{mandal.city}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{event?.name}</p>
            <p className="text-xs text-gray-400">{event?.year}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">

        {/* ── STEP: Form ── */}
        {step === 'form' && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Make a Donation</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your donation supports {mandal?.name} for {event?.name} {event?.year}.
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name *</label>
              <input
                type="text"
                value={donorName}
                onChange={e => setDonorName(e.target.value)}
                placeholder="Your full name"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number *</label>
              <input
                type="tel"
                value={donorPhone}
                onChange={e => setDonorPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
              />
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={donorAddress}
                onChange={e => setDonorAddress(e.target.value)}
                placeholder="Flat / Building / Area"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Donation Amount (₹) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-3xl font-bold
                  text-gray-900 placeholder-gray-300 focus:outline-none focus:border-orange-400
                  focus:ring-2 focus:ring-orange-100 bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleFormSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold
                py-4 rounded-xl text-base transition-colors mt-2"
            >
              Continue to Payment →
            </button>
          </div>
        )}

        {/* ── STEP: Payment (show QR) ── */}
        {step === 'payment' && event && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Pay via UPI</h1>
              <p className="text-sm text-gray-500 mt-1">
                Scan the QR code using any UPI app (GPay, PhonePe, Paytm)
              </p>
            </div>

            {/* Donor summary */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paying as</span>
                <span className="text-gray-900 font-medium">{donorName}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Amount</span>
                <span className="text-gray-900 font-bold text-lg">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* QR */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3">
              {event.upi_id ? (
                <UpiQR
                  upiId={event.upi_id}
                  name={mandal?.name || ''}
                  amount={Number(amount)}
                  note={`${event.name} ${event.year} Donation`}
                  size={200}
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
                  <p className="text-gray-400 text-xs text-center px-4">
                    UPI QR not available. Contact the organisation directly.
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">
                The amount is pre-filled. Do not change it in your UPI app.
              </p>
            </div>

            <button
              onClick={() => setStep('screenshot')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
            >
              I have paid — Upload Screenshot →
            </button>

            <button
              onClick={() => setStep('form')}
              className="w-full bg-white border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm"
            >
              ← Go Back
            </button>
          </div>
        )}

        {/* ── STEP: Screenshot upload ── */}
        {step === 'screenshot' && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Upload Payment Screenshot</h1>
              <p className="text-sm text-gray-500 mt-1">
                Take a screenshot of your UPI payment confirmation and upload it here.
                The organisation will verify it and send your receipt.
              </p>
            </div>

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${screenshotPreview
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 bg-white hover:border-orange-300 hover:bg-orange-50'}`}
            >
              {screenshotPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    className="max-h-48 rounded-lg object-contain"
                  />
                  <p className="text-green-600 text-sm font-medium">Screenshot selected ✓</p>
                  <p className="text-gray-400 text-xs">Tap to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">📸</span>
                  <p className="text-gray-600 text-sm font-medium">Tap to upload screenshot</p>
                  <p className="text-gray-400 text-xs">JPG or PNG, max 5MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotPick}
              className="hidden"
            />

            {/* Summary */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="text-gray-900 font-medium">{donorName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-900">{donorPhone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-gray-900 font-bold">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Event</span>
                <span className="text-gray-900">{event?.name} {event?.year}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmitDonation}
              disabled={submitting || !screenshot}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                text-white font-semibold py-4 rounded-xl text-base transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Donation'}
            </button>

            <button
              onClick={() => setStep('payment')}
              className="w-full bg-white border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-sm"
            >
              ← Go Back
            </button>
          </div>
        )}

        {/* ── STEP: Success ── */}
        {step === 'success' && (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-white border border-gray-200 rounded-xl p-6">

              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 text-2xl">✓</span>
              </div>

              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Donation Submitted!
              </h1>
              <p className="text-gray-500 text-sm">
                Thank you, {donorName}. Your donation to {mandal?.name} has been recorded.
              </p>

              {/* Receipt number */}
              <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl py-4 px-4">
                <p className="text-xs text-gray-400 mb-1">Your Receipt Number</p>
                <p className="text-gray-900 font-mono font-bold text-xl tracking-wide">
                  {receiptNumber}
                </p>
                <p className="text-xs text-gray-400 mt-2">Save this number for your records</p>
              </div>

              {/* Amount */}
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl py-3 px-4">
                <p className="text-xs text-gray-400 mb-1">Amount</p>
                <p className="text-gray-900 font-bold text-2xl">
                  ₹{Number(amount).toLocaleString('en-IN')}
                </p>
              </div>

              {/* What happens next */}
              <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-left">
                <p className="text-xs font-semibold text-orange-700 mb-2">What happens next</p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2 text-xs text-orange-600">
                    <span className="mt-0.5">1.</span>
                    <span>The organisation will verify your payment screenshot</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-orange-600">
                    <span className="mt-0.5">2.</span>
                    <span>Your official receipt PDF will be generated</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-orange-600">
                    <span className="mt-0.5">3.</span>
                    <span>Contact the organisation with your receipt number to get your receipt</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verify link */}
            <p className="text-xs text-gray-400">
              Verify this donation at{' '}
              <span className="font-mono text-gray-600">
                intellidon.in/verify/{receiptNumber}
              </span>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}