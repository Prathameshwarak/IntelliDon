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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, mandal_id')
        .eq('id', user.id)
        .single()

      if (!userRow || !['admin', 'manager', 'collector'].includes(userRow.role)) {
        router.push('/login')
        return
      }

      setUserRole(userRow.role)

      // Get mandal slug + name
      const { data: mandal } = await supabase
        .from('mandals')
        .select('name, slug')
        .eq('id', userRow.mandal_id)
        .single()

      if (!mandal) { router.push('/login'); return }

      // Get active event name
      const { data: events } = await supabase
        .from('events')
        .select('name, year')
        .eq('mandal_id', userRow.mandal_id)
        .eq('is_active', true)
        .order('year', { ascending: false })
        .limit(1)

      const link = `${window.location.origin}/donate/${mandal.slug}`

      setMandalName(mandal.name)
      setSlug(mandal.slug)
      setDonationLink(link)
      setEventName(events?.[0] ? `${events[0].name} ${events[0].year}` : 'Active Event')
      setLoading(false)
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ←
        </button>
        <div>
          <p className="text-xs text-gray-400">Intellidon</p>
          <p className="text-sm font-medium">{mandalName}</p>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-5">

        <div>
          <h1 className="text-lg font-semibold">Share Donation Link</h1>
          <p className="text-xs text-gray-400 mt-1">
            Share this link or QR with donors so they can donate online
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3">
          <canvas ref={canvasRef} className="rounded-lg" />
          <div className="text-center">
            <p className="text-gray-900 font-semibold text-sm">{mandalName}</p>
            <p className="text-orange-500 text-xs mt-0.5">{eventName}</p>
          </div>
        </div>

        {/* Donation link display */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 mb-1">Donation Link</p>
          <p className="text-xs font-mono text-gray-200 break-all leading-relaxed">
            {donationLink}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">

          {/* Copy link */}
          <button
            onClick={copyLink}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl text-sm transition-colors
              ${copied
                ? 'bg-green-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
          >
            <span>{copied ? '✓' : '⎘'}</span>
            <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>

          {/* Share on WhatsApp */}
          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700
              text-white font-semibold py-4 rounded-xl text-sm transition-colors"
          >
            <span>📱</span>
            <span>Share on WhatsApp</span>
          </button>

          {/* Download QR */}
          <button
            onClick={downloadQR}
            disabled={!qrGenerated}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600
              disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-sm transition-colors"
          >
            <span>↓</span>
            <span>Download QR Image</span>
          </button>

        </div>

        {/* Usage tip */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 font-medium mb-2">How to use</p>
          <div className="flex flex-col gap-1.5 text-xs text-gray-500 leading-relaxed">
            <p>• <span className="text-gray-300">Copy Link</span> — paste in WhatsApp, Instagram bio, or anywhere</p>
            <p>• <span className="text-gray-300">Share on WhatsApp</span> — opens WhatsApp with a ready message</p>
            <p>• <span className="text-gray-300">Download QR</span> — print on posters, banners, or pamphlets</p>
          </div>
        </div>

      </div>
    </div>
  )
}