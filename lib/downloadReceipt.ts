'use client'
import { generateReceiptPDF } from './generateReceiptPDF'

export type ReceiptData = {
  receiptNumber: string
  mandalName: string
  mandalAddress: string
  mandalPhone: string
  eventName: string
  donorName: string
  donorPhone: string
  donorAddress: string | null
  amount: number
  paymentMode: string
  createdAt: string
  collectedBy: string | null
  verified?: boolean
  verifiedByRole?: string | null
  verifiedAt?: string | null
}

async function buildPdfBlob(receiptData: ReceiptData): Promise<Blob> {
  const pdfBytes = await generateReceiptPDF(receiptData)
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadReceipt(receiptData: ReceiptData) {
  const blob = await buildPdfBlob(receiptData)
  triggerDownload(blob, `Receipt-${receiptData.receiptNumber}.pdf`)
}

let activeSharePromise: Promise<void> | null = null

export async function shareReceipt(receiptData: ReceiptData) {
  if (activeSharePromise) {
    return
  }

  activeSharePromise = (async () => {
    const fileName = `Receipt-${receiptData.receiptNumber}.pdf`

    const formattedAmount = `₹${Number(receiptData.amount || 0).toLocaleString('en-IN')}`
    const shareText = `*Donation Receipt — ${receiptData.mandalName}*\n\n` +
      `Receipt No: ${receiptData.receiptNumber}\n` +
      `Donor: ${receiptData.donorName}\n` +
      `Amount: ${formattedAmount}\n` +
      `Event: ${receiptData.eventName}\n\n` +
      `Thank you for your generous contribution!`

    try {
      const blob = await buildPdfBlob(receiptData)
      const file = new File([blob], fileName, { type: 'application/pdf' })

      const shareData: ShareData = {
        files: [file],
        title: `Donation Receipt ${receiptData.receiptNumber}`,
        text: shareText
      }

      const canUseNativeShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare(shareData)

      if (canUseNativeShare) {
        await navigator.share(shareData)
        return
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'InvalidStateError') {
        return
      }
      console.warn('Native file share failed:', err)
    }

    try {
      const cleanPhone = (receiptData.donorPhone || '').replace(/\D/g, '')
      const waUrl = cleanPhone && cleanPhone.length === 10
        ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(shareText)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`

      window.open(waUrl, '_blank')
    } catch (e) {
      console.error('WhatsApp share fallback error:', e)
    }
  })()

  try {
    await activeSharePromise
  } finally {
    activeSharePromise = null
  }
}
