// lib/generateReceiptPDF.js
// Uses pdf-lib — pure JS, works in Next.js API routes and on Vercel
// Install: npm install pdf-lib

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ── Helpers ────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return rgb(r, g, b)
}

function formatAmount(amount) {
  return 'Rs. ' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10] + ' '
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100)
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000)
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000)
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000)
  }

  const result = convert(Math.floor(amount)).trim()
  return result ? result + ' Rupees Only' : 'Zero Rupees'
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function paymentModeLabel(mode) {
  if (mode === 'cash') return 'Cash'
  if (mode === 'upi_collector') return 'UPI (Collector assisted)'
  if (mode === 'upi_self') return 'UPI (Self)'
  return mode
}

// ── Main generator ─────────────────────────────────────────────
/**
 * Generates a PDF receipt for a donation.
 * Returns a Uint8Array of the PDF bytes.
 *
 * @param {Object} params
 * @param {string} params.receiptNumber   e.g. "DS-2026-00001"
 * @param {string} params.mandalName      e.g. "Shree Ganesh Utsav Mandal"
 * @param {string} params.mandalAddress   e.g. "Dadar West, Mumbai"
 * @param {string} params.mandalPhone     e.g. "9876543210"
 * @param {string} params.eventName       e.g. "Ganeshotsav 2026"
 * @param {string} params.donorName       e.g. "Ramesh Patil"
 * @param {string} params.donorPhone      e.g. "9876543210"
 * @param {string} params.donorAddress    e.g. "Flat 4B, Dadar"
 * @param {number} params.amount          e.g. 1100
 * @param {string} params.paymentMode     e.g. "cash"
 * @param {string} params.createdAt       ISO date string
 * @param {string} params.collectedBy     e.g. "Akash Mane" (optional)
 */
export async function generateReceiptPDF({
  receiptNumber,
  mandalName,
  mandalAddress,
  mandalPhone,
  eventName,
  donorName,
  donorPhone,
  donorAddress,
  amount,
  paymentMode,
  createdAt,
  collectedBy
}) {
  // ── Page setup ─────────────────────────────────────────────
  // A5 size (148 x 210 mm = 419 x 595 pt) — compact, receipt-like
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([419, 595])
  const { width, height } = page.getSize()

  // Fonts — StandardFonts work without embedding, safe for Vercel
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Colours
  const BLACK    = hexToRgb('#0a0a0a')
  const GRAY     = hexToRgb('#6b7280')
  const LGRAY    = hexToRgb('#e5e7eb')
  const ORANGE   = hexToRgb('#f97316')
  const GREEN    = hexToRgb('#16a34a')
  const WHITE    = rgb(1, 1, 1)
  const BGLIGHT  = hexToRgb('#f9fafb')

  const MARGIN = 32
  const CONTENT_W = width - MARGIN * 2

  let y = height // we draw top to bottom, decrementing y

  // ── 1. Orange header bar ───────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: ORANGE })

  // Platform name — top left
  page.drawText('INTELLIDON', {
    x: MARGIN, y: height - 22,
    size: 9, font: fontBold, color: WHITE,
    letterSpacing: 1.5
  })

  // Receipt number — top right
  const rnLabel = 'RECEIPT'
  const rnLabelW = fontBold.widthOfTextAtSize(rnLabel, 8)
  page.drawText(rnLabel, {
    x: width - MARGIN - rnLabelW, y: height - 18,
    size: 8, font: fontBold, color: WHITE, opacity: 0.7
  })
  const rnW = fontBold.widthOfTextAtSize(receiptNumber, 11)
  page.drawText(receiptNumber, {
    x: width - MARGIN - rnW, y: height - 32,
    size: 11, font: fontBold, color: WHITE
  })

  // Mandal name in header
  page.drawText(mandalName.toUpperCase(), {
    x: MARGIN, y: height - 38,
    size: 11, font: fontBold, color: WHITE
  })

  // Mandal address + phone in header
  const mandalMeta = [mandalAddress, mandalPhone].filter(Boolean).join('  ·  ')
  page.drawText(mandalMeta, {
    x: MARGIN, y: height - 54,
    size: 8, font: fontRegular, color: WHITE, opacity: 0.85
  })

  y = height - 72

  // ── 2. Event + date bar ────────────────────────────────────
  page.drawRectangle({ x: 0, y: y - 30, width, height: 30, color: BGLIGHT })
  page.drawLine({ start: { x: 0, y: y }, end: { x: width, y: y }, thickness: 0.5, color: LGRAY })
  page.drawLine({ start: { x: 0, y: y - 30 }, end: { x: width, y: y - 30 }, thickness: 0.5, color: LGRAY })

  page.drawText(eventName, {
    x: MARGIN, y: y - 19,
    size: 9, font: fontBold, color: ORANGE
  })

  const dateStr = formatDate(createdAt)
  const dateW = fontRegular.widthOfTextAtSize(dateStr, 8)
  page.drawText(dateStr, {
    x: width - MARGIN - dateW, y: y - 19,
    size: 8, font: fontRegular, color: GRAY
  })

  y = y - 30

  // ── 3. Amount block ────────────────────────────────────────
  const AMOUNT_H = 80
  y -= AMOUNT_H

  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: AMOUNT_H, color: BGLIGHT, borderColor: LGRAY, borderWidth: 0.5, borderRadius: 4 })

  // Amount label
  page.drawText('DONATION AMOUNT', {
    x: MARGIN + 16, y: y + AMOUNT_H - 20,
    size: 7.5, font: fontBold, color: GRAY, letterSpacing: 0.5
  })

  // Big amount
  const amtStr = formatAmount(amount)
  page.drawText(amtStr, {
    x: MARGIN + 16, y: y + AMOUNT_H - 46,
    size: 26, font: fontBold, color: BLACK
  })

  // Amount in words
  page.drawText(amountInWords(amount), {
    x: MARGIN + 16, y: y + 14,
    size: 8, font: fontOblique, color: GRAY
  })

  // Payment mode badge — right side of amount block
  const modeLabel = paymentModeLabel(paymentMode)
  const modeBadgeW = fontBold.widthOfTextAtSize(modeLabel, 8) + 14
  const modeBadgeX = MARGIN + CONTENT_W - modeBadgeW - 12
  const modeBadgeY = y + AMOUNT_H - 36

  const modeColor = paymentMode === 'cash' ? hexToRgb('#92400e') : hexToRgb('#1e40af')
  const modeBgColor = paymentMode === 'cash' ? hexToRgb('#fef3c7') : hexToRgb('#dbeafe')

  page.drawRectangle({ x: modeBadgeX, y: modeBadgeY, width: modeBadgeW, height: 20, color: modeBgColor, borderRadius: 4 })
  page.drawText(modeLabel, {
    x: modeBadgeX + 7, y: modeBadgeY + 6,
    size: 8, font: fontBold, color: modeColor
  })

  y -= 16 // gap

  // ── 4. Donor details section ───────────────────────────────
  const drawDivider = (yPos) => {
    page.drawLine({
      start: { x: MARGIN, y: yPos },
      end: { x: width - MARGIN, y: yPos },
      thickness: 0.5, color: LGRAY
    })
  }

  const drawField = (label, value, yPos) => {
    if (!value) return 0
    page.drawText(label, { x: MARGIN, y: yPos, size: 7.5, font: fontBold, color: GRAY })
    page.drawText(String(value), { x: MARGIN + 110, y: yPos, size: 8.5, font: fontRegular, color: BLACK })
    drawDivider(yPos - 9)
    return 26 // row height
  }

  const fields = [
    ['Donor Name',       donorName],
    ['Phone',            donorPhone || '-'],
    ['Address',          donorAddress || '—'],
    ['Collected By',     collectedBy || 'Self (online)'],
    ['Payment Mode',     paymentModeLabel(paymentMode)],
  ]

  y -= 8
  page.drawText('DONOR DETAILS', {
    x: MARGIN, y,
    size: 7.5, font: fontBold, color: GRAY, letterSpacing: 0.5
  })
  y -= 16

  for (const [label, value] of fields) {
    drawField(label, value, y)
    y -= 26
  }

  y -= 8

  // ── 5. Status bar ──────────────────────────────────────────
  const STATUS_H = 32
  page.drawRectangle({
    x: MARGIN, y: y - STATUS_H,
    width: CONTENT_W, height: STATUS_H,
    color: hexToRgb('#dcfce7'), borderColor: hexToRgb('#86efac'), borderWidth: 0.5, borderRadius: 4
  })

  // Green dot
  page.drawCircle({ x: MARGIN + 16, y: y - STATUS_H / 2, size: 4, color: GREEN })

  page.drawText('VERIFIED', {
    x: MARGIN + 28, y: y - STATUS_H / 2 - 4,
    size: 8.5, font: fontBold, color: GREEN
  })

  const verifiedText = 'This donation has been verified by the mandal'
  const verifiedW = fontRegular.widthOfTextAtSize(verifiedText, 7.5)
  page.drawText(verifiedText, {
    x: MARGIN + CONTENT_W - verifiedW - 12, y: y - STATUS_H / 2 - 4,
    size: 7.5, font: fontRegular, color: GREEN, opacity: 0.8
  })

  y = y - STATUS_H - 16

  // ── 6. Verify QR note ─────────────────────────────────────
  page.drawText(`Verify this receipt at: intellidon.in/verify/${receiptNumber}`, {
    x: MARGIN, y,
    size: 7, font: fontOblique, color: GRAY
  })

  y -= 20

  // ── 7. Footer ──────────────────────────────────────────────
  page.drawLine({ start: { x: 0, y: 36 }, end: { x: width, y: 36 }, thickness: 0.5, color: LGRAY })

  page.drawText('This is a digitally generated receipt. No physical signature required.', {
    x: MARGIN, y: 22,
    size: 7, font: fontRegular, color: GRAY
  })

  const poweredBy = 'Powered by Intellidon'
  const poweredW = fontBold.widthOfTextAtSize(poweredBy, 7)
  page.drawText(poweredBy, {
    x: width - MARGIN - poweredW, y: 22,
    size: 7, font: fontBold, color: ORANGE
  })

  // ── 8. Dashed border around page ──────────────────────────
  page.drawRectangle({
    x: 8, y: 8, width: width - 16, height: height - 16,
    borderColor: LGRAY, borderWidth: 0.5,
    borderDashArray: [4, 4], color: rgb(0, 0, 0), opacity: 0
  })

  return await pdfDoc.save()
}