'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Shared helper so every place that needs the donor "scan to download receipt"
// link builds it the exact same way (single source of truth).
export function getReceiptDownloadUrl(receiptCode: string): string {
  if (typeof window === 'undefined' || !receiptCode) return ''
  return `${window.location.origin}/download-receipt?q=${encodeURIComponent(receiptCode)}`
}

type ReceiptQRCanvasProps = {
  receiptCode: string
  size?: number
  className?: string
}

// Renders the donor receipt QR code onto a canvas. Reused by ReceiptQRModal
// (full-size, donor-facing) and the collector success card (compact, inline)
// so there is exactly one QR-generation code path in the app.
export default function ReceiptQRCanvas({ receiptCode, size = 240, className = '' }: ReceiptQRCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!receiptCode || typeof window === 'undefined' || !canvasRef.current) return

    const targetUrl = getReceiptDownloadUrl(receiptCode)

    QRCode.toCanvas(
      canvasRef.current,
      targetUrl,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#1A1208',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      },
      (err) => {
        if (err) console.error('Receipt QR error:', err)

        // The 'qrcode' package's canvas renderer force-sets an INLINE
        // canvas.style.width/height (in px, matching `size`) every time it draws.
        // Inline styles beat any Tailwind class (w-full/h-full etc), so without this
        // the canvas always rendered at a fixed `size`x`size` px box regardless of its
        // actual container — overflowing and getting clipped whenever the container
        // was smaller than `size`. Clearing the inline style hands sizing back to
        // whatever CSS class the caller put on the <canvas>.
        if (canvasRef.current) {
          canvasRef.current.style.removeProperty('width')
          canvasRef.current.style.removeProperty('height')
        }
      }
    )
  }, [receiptCode, size])

  if (!receiptCode) return null

  return <canvas ref={canvasRef} className={className} />
}
