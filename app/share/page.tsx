'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

export default function SharePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [mandalName, setMandalName] = useState('')
  const [eventName, setEventName] = useState('')
  const [slug, setSlug] = useState('')
  const [donationLink, setDonationLink] = useState('')
  const [userRole, setUserRole] = useState('')
  const [copied, setCopied] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Load mandal info ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/login'); return }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const meData = await res.json()
        if (!res.ok || meData.error || !meData.user || !meData.profile) {
          router.push('/login')
          return
        }

        const role = meData.profile.role
        if (!['admin', 'manager', 'collector'].includes(role)) {
          router.push('/login')
          return
        }

        setUserRole(role)

        const mandal = meData.mandal
        if (!mandal) { router.push('/login'); return }

        setMandalName(mandal.name || '')
        const targetSlug = mandal.slug || mandal.id
        const link = `${window.location.origin}/donate/${targetSlug}`
        setSlug(targetSlug)
        setDonationLink(link)

        // Fetch active event name via API
        const eventsRes = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const eventsData = await eventsRes.json()
        if (eventsData.events && eventsData.events.length > 0) {
          const activeEv = eventsData.events.find((e: any) => e.is_active) || eventsData.events[0]
          setEventName(activeEv.name || '')
        }
      } catch (e) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  // ── Generate QR once link is ready ────────────────────────────
  useEffect(() => {
    if (!donationLink || !canvasRef.current) return

    QRCode.toCanvas(canvasRef.current, donationLink, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    }, (err) => {
      if (!err) setQrGenerated(true)
    })
  }, [donationLink])

  // ── Copy link ─────────────────────────────────────────────────
  function copyLink() {
    navigator.clipboard.writeText(donationLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // ── Download QR as image ──────────────────────────────────────
  function downloadQR() {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a bigger canvas for better print quality
    const exportCanvas = document.createElement('canvas')
    const size = 600
    const padding = 40
    const labelHeight = 80
    exportCanvas.width = size
    exportCanvas.height = size + labelHeight

    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Draw QR centered with padding
    ctx.drawImage(canvas, padding, padding, size - padding * 2, size - padding * 2)

    // Mandal name below QR
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(mandalName, size / 2, size + 30)

    // Event name
    ctx.fillStyle = '#f97316'
    ctx.font = '16px sans-serif'
    ctx.fillText(eventName, size / 2, size + 55)

    // Intellidon branding
    ctx.fillStyle = '#9ca3af'
    ctx.font = '13px sans-serif'
    ctx.fillText('intellidon.in', size / 2, size + 74)

    // Download
    const link = document.createElement('a')
    link.download = `${slug}-donation-qr.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }

  // ── Share on WhatsApp ─────────────────────────────────────────
  function shareWhatsApp() {
    const message = encodeURIComponent(
      `🙏 Support ${mandalName} for ${eventName}!\n\nDonate online here:\n${donationLink}\n\nPowered by Intellidon`
    )
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  // ── Back navigation based on role ────────────────────────────
  function goBack() {
    if (userRole === 'collector') router.push('/collect')
    else router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 flex items-center justify-center transition-colors duration-300">
        <p className="text-[#7a6a55] dark:text-gray-400 text-xs font-mono animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3] dark:bg-gray-950 text-[#1A1208] dark:text-white transition-colors duration-300">

      {/* Header */}
      <div className="bg-[#F5EDE2] dark:bg-gray-900 border-b border-[#1A1208]/10 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="text-[#7a6a55] dark:text-gray-400 hover:text-[#1A1208] dark:hover:text-white transition-colors text-base font-bold cursor-pointer"
        >
          ←
        </button>
        <div>
          <p className="text-[10px] uppercase text-[#7a6a55] dark:text-gray-400 font-bold">Intellidon</p>
          <p className="text-sm font-bold text-[#1A1208] dark:text-white">{mandalName}</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-5">

        <div>
          <h1 className="text-lg font-bold text-[#1A1208] dark:text-white">Share Donation Link</h1>
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
            Share this link or QR with donors so they can donate online
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white border border-[#1A1208]/10 dark:border-transparent rounded-2xl p-5 flex flex-col items-center gap-3 shadow-md">
          <canvas ref={canvasRef} className="rounded-lg" />
          <div className="text-center">
            <p className="text-gray-900 font-bold text-sm">{mandalName}</p>
            <p className="text-[#E8650A] text-xs font-bold mt-0.5">{eventName}</p>
          </div>
        </div>

        {/* Donation link display */}
        <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mb-1 font-bold">Donation Link</p>
          <p className="text-xs font-mono text-[#1A1208] dark:text-gray-200 break-all leading-relaxed font-semibold">
            {donationLink}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">

          {/* Copy link */}
          <button
            onClick={copyLink}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md
              ${copied
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#E8650A] to-[#f97316] hover:from-[#d05807] hover:to-[#ea580c] text-white shadow-[#E8650A]/20'}`}
          >
            <span>{copied ? '✓' : '⎘'}</span>
            <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>

          {/* Share on WhatsApp */}
          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
              text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <span>📱</span>
            <span>Share on WhatsApp</span>
          </button>

          {/* Download QR */}
          <button
            onClick={downloadQR}
            disabled={!qrGenerated}
            className="w-full flex items-center justify-center gap-2 bg-[#F5EDE2] dark:bg-gray-700 hover:bg-[#ebdcc9] dark:hover:bg-gray-600 border border-[#1A1208]/10 dark:border-gray-600
              disabled:opacity-50 text-[#1A1208] dark:text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
          >
            <span>↓</span>
            <span>Download QR Image</span>
          </button>

        </div>

        {/* Usage tip */}
        <div className="bg-[#F5EDE2] dark:bg-gray-800 border border-[#1A1208]/10 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 font-bold mb-2">How to use</p>
          <div className="flex flex-col gap-1.5 text-xs text-[#7a6a55] dark:text-gray-400 leading-relaxed font-medium">
            <p>• <span className="text-[#1A1208] dark:text-gray-300 font-bold">Copy Link</span> — paste in WhatsApp, Instagram bio, or anywhere</p>
            <p>• <span className="text-[#1A1208] dark:text-gray-300 font-bold">Share on WhatsApp</span> — opens WhatsApp with a ready message</p>
            <p>• <span className="text-[#1A1208] dark:text-gray-300 font-bold">Download QR</span> — print on posters, banners, or pamphlets</p>
          </div>
        </div>

      </div>
    </div>
  )
}