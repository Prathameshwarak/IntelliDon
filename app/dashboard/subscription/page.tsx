'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import UpiQR from '@/components/UpiQR'

type SubscriptionStatus = {
  active: boolean
  plan: string
  status: string
  startsAt: string | null
  endsAt: string | null
  daysRemaining: number
  expired: boolean
  paymentStatus: string | null
  history: any[]
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [mandalId, setMandalId] = useState('')
  const [mandalName, setMandalName] = useState('')

  // Subscription State
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null)
  const [availablePlans, setAvailablePlans] = useState<any[]>([])
  const [selectedPlanCode, setSelectedPlanCode] = useState('monthly')
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(399)
  const [transactionId, setTransactionId] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, mandal_id')
        .eq('id', user.id)
        .single()

      if (!userRow || !['admin', 'manager'].includes(userRow.role)) {
        router.push('/dashboard')
        return
      }

      const { data: mandal } = await supabase
        .from('mandals')
        .select('id, name')
        .eq('id', userRow.mandal_id)
        .single()

      setUserRole(userRow.role)
      setMandalId(userRow.mandal_id)
      setMandalName(mandal?.name || '')
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (mandalId) {
      fetchStatus()
      fetchPlans()
    }
  }, [mandalId])

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/subscription/status?mandal_id=${mandalId}`)
      const data = await res.json()
      if (data.success) {
        setSubStatus(data)
      }
    } catch (err) {
      console.error('Error fetching subscription status:', err)
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      if (data.success && data.plans) {
        setAvailablePlans(data.plans)
        if (data.plans.length > 0) {
          const defaultPlan = data.plans.find((p: any) => p.code === 'monthly') || data.plans[0]
          setSelectedPlanCode(defaultPlan.code)
          setSelectedPlanPrice(defaultPlan.price)
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  }

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setScreenshot(file)
      setScreenshotPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmitRenewal = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!transactionId.trim()) {
      setError('Please enter payment reference / Transaction ID')
      return
    }

    setSubmitting(true)
    let screenshotUrl = ''

    try {
      // 1. Upload screenshot if selected
      if (screenshot) {
        setUploading(true)
        const formData = new FormData()
        formData.append('file', screenshot)
        formData.append('mandal_id', mandalId)

        const uploadRes = await fetch('/api/donate/upload-screenshot', {
          method: 'POST',
          body: formData,
        })
        const uploadData = await uploadRes.json()
        setUploading(false)

        if (uploadData.error) {
          setError(uploadData.error)
          setSubmitting(false)
          return
        }
        screenshotUrl = uploadData.url
      }

      // 2. Submit renewal request
      const res = await fetch('/api/subscription/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandal_id: mandalId,
          plan: selectedPlanCode,
          amount: selectedPlanPrice,
          payment_notes: `Txn ID: ${transactionId}`,
          screenshot_url: screenshotUrl
        })
      })

      const result = await res.json()
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Your renewal request has been submitted successfully! It is pending Super Admin verification.')
        setTransactionId('')
        setScreenshot(null)
        setScreenshotPreview(null)
        fetchStatus()
      }
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-xs text-orange-500 hover:text-orange-400 font-medium mb-1 flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-base font-semibold text-white">Subscription Management</h1>
        </div>
        <p className="text-xs text-gray-400">{mandalName}</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
        
        {/* Status card */}
        {subStatus && (
          <div className={`border rounded-xl p-6 transition-all
            ${subStatus.expired 
              ? 'bg-red-950/20 border-red-900/50' 
              : subStatus.plan === 'trial' 
                ? 'bg-orange-950/20 border-orange-900/40' 
                : 'bg-green-950/20 border-green-900/40'}`}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Current Active Plan</h2>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider
                    ${subStatus.expired 
                      ? 'bg-red-900/60 text-white' 
                      : subStatus.plan === 'trial' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-green-600 text-white'}`}>
                    {subStatus.plan} Plan
                  </span>
                  <span className={`text-xs font-semibold uppercase tracking-wider
                    ${subStatus.expired ? 'text-red-400' : 'text-emerald-400'}`}>
                    ● {subStatus.expired ? 'Expired' : 'Active'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2 font-mono">
                  Validity: {subStatus.startsAt ? new Date(subStatus.startsAt).toLocaleDateString() : 'N/A'} - {subStatus.endsAt ? new Date(subStatus.endsAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-white">{subStatus.daysRemaining}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Days Remaining</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Plans We Offer */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Choose a Plan</h2>
            <p className="text-xs text-gray-400">Select a plan to renew or extend your current subscription. Renewal stacked on top of active plan validity.</p>
            
            <div className="flex flex-col gap-3">
              {availablePlans.map((p) => {
                const isSelected = selectedPlanCode === p.code
                return (
                  <div 
                    key={p.id || p.code}
                    onClick={() => {
                      setSelectedPlanCode(p.code)
                      setSelectedPlanPrice(p.price)
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200
                      ${isSelected 
                        ? 'bg-orange-950/20 border-orange-500 shadow-md shadow-orange-950/20' 
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-white">{p.name}</span>
                      <span className="text-base font-bold text-white">₹{p.price.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/{p.duration_days === 30 ? 'mo' : p.duration_days === 365 ? 'yr' : `${p.duration_days}d`}</span></span>
                    </div>
                    {p.description && <p className="text-[11px] text-gray-500 mt-1.5">{p.description}</p>}
                    {p.features && p.features.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-3">
                        {p.features.map((f: string) => (
                          <span key={f} className="bg-gray-950 border border-gray-850 px-1.5 py-0.5 rounded text-[9px] text-gray-400 capitalize">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Payment Details</h2>
            <p className="text-xs text-gray-400">Scan this code using any UPI app (GPay, PhonePe, Paytm) to make the payment to IntelliDon subscription service.</p>

            <div className="flex justify-center py-2 bg-gray-950/40 rounded-xl border border-gray-850">
              <UpiQR
                upiId="intellidon@okaxis"
                name="IntelliDon Platform"
                amount={selectedPlanPrice}
                note={`Subscription - ${mandalName}`}
                size={180}
              />
            </div>

            <form onSubmit={handleSubmitRenewal} className="flex flex-col gap-4">
              {error && <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 px-3 py-2 rounded-lg">{error}</p>}
              {success && <p className="text-xs text-green-400 bg-green-950/20 border border-green-900/50 px-3 py-2 rounded-lg">{success}</p>}

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Transaction ID / Reference ID *</label>
                <input
                  type="text"
                  placeholder="Enter 12-digit UPI Ref / Transaction ID"
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Upload Receipt Screenshot</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
                />
                {screenshotPreview && (
                  <img src={screenshotPreview} alt="Preview" className="w-20 rounded-lg border border-gray-800 mt-2" />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors shadow-md"
              >
                {submitting ? (uploading ? 'Uploading screenshot...' : 'Submitting request...') : `Pay & Submit Request`}
              </button>
            </form>
          </div>
        </div>

        {/* History Log */}
        <div>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Request Log</h2>
          {subStatus && subStatus.history && subStatus.history.length === 0 ? (
            <p className="text-xs text-gray-500 bg-gray-900/30 border border-gray-800 rounded-xl p-4 text-center">No payment requests recorded yet.</p>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/40 text-gray-500 font-medium">
                      <th className="p-3">Requested On</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3">Validity Starts</th>
                      <th className="p-3">Validity Ends</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {subStatus?.history?.map((h: any) => (
                      <tr key={h.id} className="hover:bg-gray-800/10 transition-colors">
                        <td className="p-3 text-gray-400 font-mono">
                          {new Date(h.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-semibold text-white uppercase">{h.plan}</td>
                        <td className="p-3 font-bold text-white">₹{Number(h.amount).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide
                            ${h.payment_status === 'verified' ? 'bg-green-950 text-green-400 border border-green-900/20' 
                            : h.payment_status === 'rejected' ? 'bg-red-950 text-red-400 border border-red-900/20'
                            : 'bg-yellow-950 text-yellow-400 border border-yellow-900/20'}`}>
                            {h.payment_status}
                          </span>
                          {h.status === 'active' && h.payment_status === 'verified' && (
                            <span className="ml-1.5 text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/30">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400 font-mono">
                          {h.starts_at ? new Date(h.starts_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3 text-gray-400 font-mono">
                          {h.ends_at ? new Date(h.ends_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-3 text-gray-400 max-w-xs truncate" title={h.payment_notes}>
                          {h.payment_notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
