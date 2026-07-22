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

export async function shareReceipt(receiptData: ReceiptData) {
  const fileName = `Receipt-${receiptData.receiptNumber}.pdf`

  let blob: Blob
  try {
    blob = await buildPdfBlob(receiptData)
  } catch (err) {
    console.error('Failed to generate receipt PDF:', err)
    return
  }

  // Everything below (including the canShare capability check) is wrapped
  // in try/catch — some browsers throw rather than return false when the
  // ShareData shape isn't supported, which previously crashed the click
  // handler silently and made "Share" look like it did nothing.
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' })

    const shareData: ShareData = {
      files: [file],
      title: `Donation Receipt ${receiptData.receiptNumber}`,
      text: `Donation receipt for ${receiptData.donorName} — ${receiptData.receiptNumber}`
    }

    const canUseNativeShare =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(shareData)

    if (canUseNativeShare) {
      await navigator.share(shareData)
      return
    }
  } catch (err) {
    // User cancelled the native share sheet — do nothing.
    if ((err as DOMException)?.name === 'AbortError') return
    console.error('Native share failed, falling back to download:', err)
  }

  triggerDownload(blob, fileName)
}
