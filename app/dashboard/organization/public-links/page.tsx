'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import OrgShell from '@/components/dashboard/OrgShell'
import { useOrg } from '@/components/dashboard/OrgContext'

export default function PublicDonationLinksPage() {
  const router = useRouter()
  const { loading, mandalId, mandalName, getAuthHeaders } = useOrg()
  const [slug, setSlug] = useState('')
  const [donationLink, setDonationLink] = useState('')
  const [eventName, setEventName] = useState('')
  const [hasActiveEvent, setHasActiveEvent] = useState(true)
  const [fetching, setFetching] = useState(true)
  const [copied, setCopied] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function init() {
      if (!mandalId) return
      setFetching(true)
      try {
        const headers = await getAuthHeaders()
        const meRes = await fetch('/api/auth/me', { headers })
        const meData = await meRes.json()
        const mandal = meData.mandal
        const targetSlug = mandal?.slug || mandalId
        setSlug(targetSlug)
        setDonationLink(`${window.location.origin}/donate/${targetSlug}`)

        const eventsRes = await fetch(`/api/events?mandal_id=${mandalId}`, { headers })
        const eventsData = await eventsRes.json()
        const activeEv = eventsData.events?.find((e: any) => e.is_active)
        if (activeEv) {
          setEventName(activeEv.name || '')
          setHasActiveEvent(true)
        } else {
          setEventName('No Active Event')
          setHasActiveEvent(false)
        }
      } catch {
      } finally {
        setFetching(false)
      }
    }
    init()
  }, [mandalId])

  useEffect(() => {
    if (!donationLink || fetching || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, donationLink, {
      width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'M',
    }, (err) => { if (!err) setQrGenerated(true) })
  }, [donationLink, fetching])

  function copyLink() {
    navigator.clipboard.writeText(donationLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function downloadQR() {
    if (!hasActiveEvent) return
    const canvas = canvasRef.current
    if (!canvas) return
    const exportCanvas = document.createElement('canvas')
    const size = 600
    const padding = 40
    const labelHeight = 80
    exportCanvas.width = size
    exportCanvas.height = size + labelHeight
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(canvas, padding, padding, size - padding * 2, size - padding * 2)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(mandalName, size / 2, size + 30)
    ctx.fillStyle = '#f97316'
    ctx.font = '16px sans-serif'
    ctx.fillText(eventName, size / 2, size + 55)
    ctx.fillStyle = '#9ca3af'
    ctx.font = '13px sans-serif'
    ctx.fillText('intellidon.in', size / 2, size + 74)
    const link = document.createElement('a')
    link.download = `${slug}-donation-qr.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }

  function shareWhatsApp() {
    const message = encodeURIComponent(
      `🙏 Support ${mandalName}${eventName ? ` for ${eventName}` : ''}!\n\nDonate online here:\n${donationLink}\n\nPowered by Intellidon`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  return (
    <OrgShell title="Public Donation Links" subtitle="Share this link or QR with donors so they can donate online">
      {loading || fetching ? (
        <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-mono animate-pulse">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4 max-w-sm">
          {!hasActiveEvent && (
            <div className="bg-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed shadow-xs">
              <span className="text-amber-600 dark:text-amber-400 text-base font-bold shrink-0">📌</span>
              <div>
                <strong className="font-bold text-[#1A1208] dark:text-white block mb-0.5">No Active Event</strong>
                You must activate an event in the dashboard before donors can contribute.
              </div>
            </div>
          )}

          <div className="bg-white border border-[#1A1208]/10 dark:border-gray-800 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-md relative overflow-hidden">
            {!hasActiveEvent && (
              <div className="absolute inset-0 z-10 bg-black/45 backdrop-blur-[3px] flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-full text-xs mb-2 shadow flex items-center gap-1">
                  <span>⚠️</span> No Active Event
                </div>
                <p className="text-white text-xs font-semibold max-w-[210px] leading-snug drop-shadow-md">
                  Donations are disabled because no event is currently active.
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="mt-3 px-3.5 py-1.5 bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  ⚡ Activate an Event
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className={`rounded-lg transition-all ${!hasActiveEvent ? 'blur-md opacity-30 select-none' : ''}`} />
            <div className="text-center">
              <p className="text-gray-900 font-bold text-sm">{mandalName}</p>
              <p className={`text-xs font-bold mt-0.5 ${hasActiveEvent ? 'text-[#E8650A]' : 'text-amber-600'}`}>{eventName}</p>
            </div>
          </div>

          <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
            <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 font-bold">Donation Link</p>
            <p className="text-xs font-mono text-[#1A1208] dark:text-gray-200 break-all leading-relaxed font-semibold">{donationLink}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={copyLink}
              className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md
                ${copied ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-[#E8650A] to-[#f97316] text-white shadow-[#E8650A]/20'}`}
            >
              <span>{copied ? '✓' : '⎘'}</span>
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
            <button
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <span>📱</span><span>Share on WhatsApp</span>
            </button>
            <button
              onClick={downloadQR}
              disabled={!qrGenerated || !hasActiveEvent}
              className="w-full flex items-center justify-center gap-2 bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 border border-[#1A1208]/10 dark:border-gray-600 disabled:opacity-50 text-[#1A1208] dark:text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
            >
              <span>↓</span><span>Download QR Image</span>
            </button>
          </div>
        </div>
      )}
    </OrgShell>
  )
}
