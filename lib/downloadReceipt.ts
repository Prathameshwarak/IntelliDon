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
  const blob = await buildPdfBlob(receiptData)
  const fileName = `Receipt-${receiptData.receiptNumber}.pdf`
  const file = new File([blob], fileName, { type: 'application/pdf' })

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName })
      return
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
    }
  }

  triggerDownload(blob, fileName)
}
