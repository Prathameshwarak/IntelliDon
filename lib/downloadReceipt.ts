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

export async function shareReceipt(receiptData: ReceiptData) {
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

  const waUrl = targetPhone
    ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(shareText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`

  window.open(waUrl, '_blank')
}
