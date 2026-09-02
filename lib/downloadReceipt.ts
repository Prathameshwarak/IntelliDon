'use client'
import { generateReceiptPDF } from './generateReceiptPDF'

export type ReceiptData = {
  receiptNumber: string
  receiptCode?: string | null
  mandalName: string
  mandalAddress: string
  mandalPhone: string
  mandalEmail?: string | null
  mandalLogo?: string | null
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
  screenshotUrl?: string | null
  screenshotImage?: string | Uint8Array | null
}

export function formatLegalEmail(email?: string | null): string {
  if (email && email.includes('@')) {
    const parts = email.trim().split('@')
    const user = parts[0]
    const domain = parts.slice(1).join('@')
    return `${user}+legal@${domain}`
  }
  return ''
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

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const receiptLink = receiptData.receiptCode && origin
      ? `${origin}/download-receipt?q=${encodeURIComponent(receiptData.receiptCode)}`
      : ''

    let shareText = `*🙏 ${receiptData.mandalName}*\n` +
      `*Donation Receipt* — ${receiptData.eventName}\n\n` +
      `📌 *Receipt No:* ${receiptData.receiptNumber}\n`

    if (receiptData.receiptCode) {
      shareText += `🔑 *4-Digit Code:* ${receiptData.receiptCode}\n`
    }

    shareText += `👤 *Donor Name:* ${receiptData.donorName}\n` +
      `💰 *Amount:* ${formattedAmount}\n` +
      `💳 *Payment Mode:* ${receiptData.paymentMode}\n`

    if (receiptLink) {
      shareText += `\n📄 *View / Download Receipt:* ${receiptLink}\n`
    }

    shareText += `\nThank you for your generous contribution!`

    const cleanPhone = (receiptData.donorPhone || '').replace(/\D/g, '')
    const targetPhone = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : ''

    // Direct WhatsApp redirect to donor phone number if provided in collection form
    if (targetPhone) {
      // 1. Download PDF locally so collector has the file ready
      try {
        await downloadReceipt(receiptData)
      } catch (err) {
        console.warn('PDF auto-download before WhatsApp redirect error:', err)
      }

      // 2. Open WhatsApp directly to donor contact with custom message & receipt link
      const waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(shareText)}`
      window.open(waUrl, '_blank')
      return
    }

    // Fallback if no phone number was entered in form
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

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
    window.open(waUrl, '_blank')
  })()

  try {
    await activeSharePromise
  } finally {
    activeSharePromise = null
  }
}
