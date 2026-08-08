'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { downloadReceipt, shareReceipt, type ReceiptData } from '@/lib/downloadReceipt'

type ReceiptSearchResult = {
  id: string
  receipt_number: string
  receipt_code: string | null
  donor_name: string
  donor_phone: string
  amount: number
  status: string
  created_at: string
  mandal_name: string
  event_name: string
  screenshot_url: string | null
  receipt_data: ReceiptData
}

function DownloadReceiptContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const slug = searchParams.get('slug') || searchParams.get('mandal') || ''

  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [receipts, setReceipts] = useState<ReceiptSearchResult[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleSearch(searchQuery?: string) {
    const qToUse = searchQuery !== undefined ? searchQuery : query
    const trimmed = qToUse.trim()

    if (!trimmed) {
      setError('Please enter your 4-digit code, phone number, or receipt number.')
      return
    }

    if (/^\d+$/.test(trimmed) && trimmed.length > 0 && trimmed.length < 10) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    setError('')
    setLoading(true)
    setSearched(true)
    setReceipts([])

    try {
      let url = `/api/donations/download-search?q=${encodeURIComponent(trimmed)}`
      if (slug) {
        url += `&slug=${encodeURIComponent(slug)}`
      }

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to search receipts.')
        return
      }

      setReceipts(data.receipts || [])
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto search if query param is present on mount
  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch(initialQuery)
    }
  }, [])

  async function handleDownloadPDF(item: ReceiptSearchResult) {
    setDownloadingId(item.id)
    try {
      await downloadReceipt(item.receipt_data)
    } catch (err) {
      console.error('Download error:', err)
      alert('Could not download PDF. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleShareWhatsApp(item: ReceiptSearchResult) {
    try {
      await shareReceipt(item.receipt_data)
    } catch (err) {
      console.error('Share error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2D251E]">
      {/* Header */}
      <header className="bg-white border-b border-[#EAE0D2] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="font-extrabold text-xl tracking-tight text-[#E05305]">
              Intelli<span className="text-[#2D251E]">don</span>
            </span>
          </Link>
          {slug && (
            <Link
              href={`/donate/${slug}`}
              className="text-xs text-[#E05305] font-semibold hover:underline flex items-center gap-1"
            >
              ← Back to Donation Link
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Banner Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#E05305]/10 border border-[#E05305]/20 text-[#E05305] px-3.5 py-1.5 rounded-full text-xs font-bold mb-3">
            <span>📄 Instant PDF Receipt Lookup</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#2D251E] tracking-tight">
            Download Your Donation Receipt
          </h1>
          <p className="text-sm text-[#7A6F64] mt-2 max-w-md mx-auto">
            Enter your <strong className="text-[#2D251E]">4-digit alphanumeric code</strong> or{' '}
            <strong className="text-[#2D251E]">phone number</strong> to preview and download your official receipt.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="bg-white border border-[#EAE0D2] rounded-2xl p-4 md:p-6 shadow-sm mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value
                  const isDigitsOnly = /^\d+$/.test(val.trim())
                  if (isDigitsOnly) {
                    if (val.trim().length <= 10) {
                      setQuery(val)
                    }
                  } else {
                    setQuery(val.slice(0, 15))
                  }
                }}
                placeholder="Enter 4-digit code (e.g. A8X2) or phone number"
                className="w-full bg-[#FAF6F0] border border-[#D8C8B5] rounded-xl px-4 py-3.5 text-base font-medium text-[#2D251E] placeholder-[#9E8C76] focus:outline-none focus:border-[#E05305] focus:ring-2 focus:ring-[#E05305]/20 transition-all uppercase tracking-wide"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSearched(false)
                    setReceipts([])
                    setError('')
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-semibold p-1"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#E05305] hover:bg-[#c94803] disabled:opacity-60 text-white font-bold px-6 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>🔍 Search Receipt</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Helper Tips */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#8C7E70] items-center">
            <span className="font-semibold text-[#52473C]">Tips:</span>
            <span className="bg-[#FAF6F0] border border-[#EAE0D2] px-2.5 py-1 rounded-md">
              💡 4-Digit Code given after donation (e.g. <strong className="font-mono text-[#E05305]">A8X2</strong>)
            </span>
            <span className="bg-[#FAF6F0] border border-[#EAE0D2] px-2.5 py-1 rounded-md">
              📱 10-digit Donor Phone Number
            </span>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {loading && (
          <div className="bg-white border border-[#EAE0D2] rounded-2xl p-8 text-center">
            <div className="w-8 h-8 border-3 border-[#E05305] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#7A6F64]">Searching database for your receipt...</p>
          </div>
        )}

        {!loading && searched && receipts.length === 0 && !error && (
          <div className="bg-white border border-[#EAE0D2] rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
              🔍
            </div>
            <h3 className="text-lg font-bold text-[#2D251E] mb-1">No Receipt Found</h3>
            <p className="text-sm text-[#7A6F64] max-w-sm mx-auto">
              We couldn't find any receipt matching "<strong className="text-[#2D251E]">{query}</strong>".
              Please double check the 4-digit code or mobile number and try again.
            </p>
          </div>
        )}

        {!loading && receipts.length > 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#2D251E]">
                Found {receipts.length} Receipt{receipts.length > 1 ? 's' : ''}
              </h2>
              <span className="text-xs text-[#8C7E70]">Tap preview or download below</span>
            </div>

            {receipts.map((item) => {
              const isVerified = item.status === 'verified'
              const formattedAmount = Number(item.amount || 0).toLocaleString('en-IN')
              const formattedDate = new Date(item.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#EAE0D2] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {/* Card Top Header */}
                  <div className="bg-[#FAF6F0] border-b border-[#EAE0D2] px-5 py-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#E05305] uppercase tracking-wider">
                        {item.mandal_name}
                      </p>
                      <p className="text-sm font-semibold text-[#2D251E] mt-0.5">
                        {item.event_name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Verification Status Badge */}
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isVerified ? '✓ Confirmed' : '⏳ Verification Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Key Details */}
                    <div className="space-y-3.5">
                      <div>
                        <span className="text-[11px] text-[#8C7E70] uppercase font-semibold block">
                          Receipt Identifiers
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#2D251E] bg-[#FAF6F0] px-2.5 py-1 rounded-md border border-[#EAE0D2]">
                            No: {item.receipt_number}
                          </span>
                          {item.receipt_code && (
                            <span className="font-mono text-xs font-extrabold text-[#E05305] bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200">
                              Code: {item.receipt_code}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] text-[#8C7E70] uppercase font-semibold block">
                            Donor Name
                          </span>
                          <p className="text-sm font-bold text-[#2D251E] mt-0.5">
                            {item.donor_name}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-[#8C7E70] uppercase font-semibold block">
                            Date
                          </span>
                          <p className="text-sm font-semibold text-[#2D251E] mt-0.5">
                            {formattedDate}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#8C7E70] uppercase font-semibold block">
                          Donation Amount
                        </span>
                        <p className="text-2xl font-extrabold text-[#E05305] mt-0.5">
                          ₹{formattedAmount}
                        </p>
                      </div>
                    </div>

                    {/* Quick Preview Box */}
                    <div className="bg-[#FAF6F0] border border-[#EAE0D2] rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#52473C]">Receipt Preview</span>
                          <span className="text-[10px] text-[#8C7E70]">Sec 80G Eligible</span>
                        </div>
                        <div className="bg-white border border-[#E5D7C5] rounded-lg p-3 text-xs space-y-1.5">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-[#8C7E70]">Org:</span>
                            <span className="font-semibold text-[#2D251E] truncate max-w-[140px]">
                              {item.mandal_name}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-[#8C7E70]">Payment Mode:</span>
                            <span className="font-semibold text-[#2D251E] capitalize">
                              {item.receipt_data.paymentMode === 'cash' ? 'Cash' : 'UPI / Digital'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8C7E70]">Code:</span>
                            <span className="font-mono font-bold text-[#E05305]">
                              {item.receipt_code || '--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleDownloadPDF(item)}
                          disabled={downloadingId === item.id}
                          className="flex-1 bg-[#E05305] hover:bg-[#c94803] disabled:opacity-60 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          {downloadingId === item.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <span>📥 Download PDF</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleShareWhatsApp(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>💬 WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function DownloadReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-[#E05305] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">Loading receipt page...</p>
          </div>
        </div>
      }
    >
      <DownloadReceiptContent />
    </Suspense>
  )
}
