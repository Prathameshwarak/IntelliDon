'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type UpiQRProps = {
  upiId: string          // e.g. "mandal@okaxis"
  name: string           // e.g. "Shree Ganesh Mandal"
  amount: number         // e.g. 500
  note?: string          // e.g. "Ganeshotsav 2026 Donation"
  size?: number          // canvas size in px, default 220
}

export default function UpiQR({ upiId, name, amount, note = 'Donation', size = 220 }: UpiQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!upiId || !amount || !canvasRef.current) return

    // Standard UPI deep link URI
    // pa = payee address (UPI ID)
    // pn = payee name
    // am = amount (fixed — donor cannot change this in their UPI app)
    // cu = currency (always INR)
    // tn = transaction note
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`

    QRCode.toCanvas(canvasRef.current, upiUri, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M'
    }, (err) => {
      if (err) {
        console.error('QR generation error:', err)
        setError(true)
      }
    })
  }, [upiId, amount, name, note, size])

  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-xl border border-gray-700"
        style={{ width: size, height: size }}>
        <p className="text-red-400 text-xs text-center px-4">Could not generate QR. Check UPI ID.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* White background so QR is scannable on dark screens */}
      <div className="bg-white rounded-xl p-3 shadow-lg">
        <canvas ref={canvasRef} />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-2xl">₹{amount.toLocaleString('en-IN')}</p>
        <p className="text-gray-400 text-xs mt-1">{name}</p>
        <p className="text-gray-500 text-xs">{upiId}</p>
      </div>
    </div>
  )
}