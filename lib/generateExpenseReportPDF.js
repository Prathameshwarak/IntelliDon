// lib/generateExpenseReportPDF.js
// Uses pdf-lib — same approach as lib/generateReceiptPDF.js.
// Builds a simple tabular PDF of an event's expenses.

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return rgb(r, g, b)
}

// pdf-lib's StandardFonts use WinAnsi encoding, which has no ₹ glyph and
// throws if you try to draw one — use "Rs." instead, same as the receipt PDF.
function formatAmount(amount) {
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(text, maxChars) {
  if (!text) return '—'
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
}

/**
 * Generates a PDF expense report for an event.
 * Returns a Uint8Array of the PDF bytes.
 *
 * @param {Object} params
 * @param {string} params.eventLabel        e.g. "Ganeshotsav 2026"
 * @param {Array}  params.expenses          list of { expense_date, vendor_name, vendor_phone, title, amount, transaction_id }
 * @param {{ total_amount: number, count: number }} params.summary
 */
export async function generateExpenseReportPDF({ eventLabel, expenses, summary }) {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const BLACK = hexToRgb('#0a0a0a')
  const GRAY = hexToRgb('#6b7280')
  const LGRAY = hexToRgb('#e5e7eb')
  const ORANGE = hexToRgb('#f97316')
  const WHITE = rgb(1, 1, 1)

  const PAGE_W = 595.28 // A4
  const PAGE_H = 841.89
  const MARGIN = 40
  const usableWidth = PAGE_W - MARGIN * 2

  // Column layout
  const cols = [
    { key: 'date', label: 'Date', width: 62 },
    { key: 'vendor', label: 'Vendor', width: 105 },
    { key: 'phone', label: 'Phone', width: 68 },
    { key: 'title', label: 'Title', width: 130 },
    { key: 'txn', label: 'Txn ID', width: 70 },
    { key: 'amount', label: 'Amount', width: usableWidth - (62 + 105 + 68 + 130 + 70) }
  ]
  let colX = []
  {
    let x = MARGIN
    for (const c of cols) { colX.push(x); x += c.width }
  }

  const ROW_H = 20
  const HEADER_H = 22

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 50

  function drawHeader() {
    page.drawText('Expense Report', { x: MARGIN, y, size: 16, font: fontBold, color: BLACK })
    y -= 20
    page.drawText(eventLabel, { x: MARGIN, y, size: 10, font: fontRegular, color: GRAY })
    y -= 14
    page.drawText(`Generated ${new Date().toLocaleString('en-IN')}`, { x: MARGIN, y, size: 8, font: fontRegular, color: GRAY })
    y -= 22
    drawTableHeader()
  }

  function drawTableHeader() {
    page.drawRectangle({ x: MARGIN, y: y - HEADER_H + 6, width: usableWidth, height: HEADER_H, color: ORANGE })
    cols.forEach((c, i) => {
      page.drawText(c.label, { x: colX[i] + 4, y: y - 10, size: 9, font: fontBold, color: WHITE })
    })
    y -= HEADER_H
  }

  function ensureSpace() {
    if (y < MARGIN + ROW_H) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - 50
      drawTableHeader()
    }
  }

  drawHeader()

  expenses.forEach((exp, idx) => {
    ensureSpace()
    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - ROW_H + 5, width: usableWidth, height: ROW_H, color: LGRAY, opacity: 0.4 })
    }
    const rowValues = [
      formatDate(exp.expense_date),
      truncate(exp.vendor_name, 20),
      exp.vendor_phone || '—',
      truncate(exp.title, 24),
      exp.transaction_id ? truncate(exp.transaction_id, 14) : '—',
      formatAmount(exp.amount)
    ]
    rowValues.forEach((val, i) => {
      page.drawText(String(val), { x: colX[i] + 4, y: y - 10, size: 8.5, font: fontRegular, color: BLACK })
    })
    y -= ROW_H
  })

  ensureSpace()
  y -= 10
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + usableWidth, y }, thickness: 1, color: LGRAY })
  y -= 18
  page.drawText(
    `Total: ${formatAmount(summary.total_amount)} across ${summary.count} entr${summary.count === 1 ? 'y' : 'ies'}`,
    { x: MARGIN, y, size: 11, font: fontBold, color: BLACK }
  )

  return pdfDoc.save()
}
