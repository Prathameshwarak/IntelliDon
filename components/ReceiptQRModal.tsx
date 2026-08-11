'use client'

import { useState } from 'react'
import ReceiptQRCanvas, { getReceiptDownloadUrl } from './ReceiptQRCanvas'

type ReceiptQRModalProps = {
  isOpen: boolean
  onClose: () => void
  receiptCode: string
  receiptNumber: string
  donorName: string
  mandalName: string
}

export default function ReceiptQRModal({
  isOpen,
  onClose,
  receiptCode,
  receiptNumber,
  donorName,
  mandalName
}: ReceiptQRModalProps) {
  const [copied, setCopied] = useState(false)
  const qrUrl = getReceiptDownloadUrl(receiptCode)

  if (!isOpen) return null

  function handleCopyLink() {
    if (!qrUrl) return
    navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-gray-800 text-center relative flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold p-1"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-[#E8650A] dark:text-orange-400 px-3 py-1 rounded-full text-xs font-bold mb-2">
            <span>📱 Donor Receipt QR Code</span>
          </div>
          <h3 className="text-lg font-extrabold text-[#1A1208] dark:text-white">
            Scan to Download Receipt
          </h3>
          <p className="text-xs text-[#7a6a55] dark:text-gray-400 mt-1 font-medium">
            Ask donor to scan this QR code with their mobile camera to get their receipt instantly.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-md mb-3 flex flex-col items-center">
          <ReceiptQRCanvas receiptCode={receiptCode} size={240} className="rounded-lg" />
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Pre-entered 4-Digit Code
            </span>
            <span className="text-xl font-mono font-black text-[#E8650A]">
              {receiptCode}
            </span>
          </div>
        </div>

        {/* Instructions Box below QR */}
        <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-xs font-semibold text-orange-800 leading-relaxed">
            📲 Scan this QR code with any smartphone camera to open the download page with pre-entered 4-digit code <strong className="font-mono text-[#E8650A] font-bold">{receiptCode}</strong> and preview or download receipt instantly.
          </p>
        </div>

        {/* Information Summary */}
        <div className="w-full bg-[#FAF6F0] dark:bg-gray-950 rounded-xl p-3 border border-[#EAE0D2] dark:border-gray-800 mb-4 text-left text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Donor:</span>
            <span className="font-bold text-gray-900 dark:text-white truncate max-w-[160px]">{donorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Receipt No:</span>
            <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{receiptNumber}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            {copied ? '✓ Link Copied' : '🔗 Copy Direct Link'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-[#E8650A] hover:bg-[#d05807] text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
