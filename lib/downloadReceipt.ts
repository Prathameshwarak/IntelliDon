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
      `*देणगी पावती / Donation Receipt*\n` +
      `🚩 *कार्यक्रम / Event:* ${receiptData.eventName}\n\n` +
      `📌 *पावती क्र. / Receipt No:* ${receiptData.receiptNumber}\n`

    if (receiptData.receiptCode) {
      shareText += `🔑 *४-अंकी कोड / Code:* ${receiptData.receiptCode}\n`
    }

    shareText += `👤 *देणगीदार / Donor:* ${receiptData.donorName}\n` +
      `💰 *रक्कम / Amount:* ${formattedAmount}\n` +
      `💳 *भरणा प्रकार / Mode:* ${receiptData.paymentMode}\n`

    if (receiptLink) {
      shareText += `\n📄 *पावती डाउनलोड करा / Download Receipt:*\n${receiptLink}\n`
    }

    shareText += `\nआपल्या मोलाच्या सहकार्याबद्दल मनःपूर्वक धन्यवाद! 🙏\nThank you for your generous contribution!`

    const cleanPhone = (receiptData.donorPhone || '').replace(/\D/g, '')
    const targetPhone = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : ''

    // 1. Generate the PDF blob dynamically on-the-fly with all details
    let pdfFile: File | null = null
    try {
      const blob = await buildPdfBlob(receiptData)
      pdfFile = new File([blob], fileName, { type: 'application/pdf' })
    } catch (e) {
      console.warn('PDF blob generation for share warning:', e)
    }

    const shareData: ShareData | null = pdfFile ? {
      files: [pdfFile],
      title: `Donation Receipt ${receiptData.receiptNumber}`,
      text: shareText
    } : null

    const canUseNativeFileShare =
      shareData &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(shareData)

    // 2. If the device/browser supports native file sharing (Mobile Web/Safari/Chrome),
    // share the actual generated .pdf file directly along with the custom text!
    if (canUseNativeFileShare && shareData) {
      try {
        await navigator.share(shareData)
        return
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.name === 'InvalidStateError') {
          return
        }
        console.warn('Native file share skipped, using direct WhatsApp redirect:', err)
      }
    }

    // 3. Direct WhatsApp redirect to donor phone number if provided in collection form
    if (targetPhone) {
      // Auto-trigger PDF download locally so collector has the file saved on device
      try {
        await downloadReceipt(receiptData)
      } catch (err) {
        console.warn('PDF auto-download before WhatsApp redirect error:', err)
      }

      const waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(shareText)}`
      window.open(waUrl, '_blank')
      return
    }

    // 4. Fallback if no phone number was entered in collection form
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
    window.open(waUrl, '_blank')
  })()

  try {
    await activeSharePromise
  } finally {
    activeSharePromise = null
  }
}
