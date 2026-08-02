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
  return 'Rs. ' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(text, maxChars) {
  if (!text) return '—'
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
}

// Transaction IDs now live on individual payments (installments) rather
// than on the expense itself, so this joins whichever ones exist into a
// single display value for the report row.
function transactionIdsFor(exp) {
  const ids = (exp.payments || []).map(p => p.transaction_id).filter(Boolean)
  return ids.length ? ids.join(', ') : (exp.transaction_id || '—')
}

/**
 * Generates a PDF expense report for an event.
 * Returns a Uint8Array of the PDF bytes.
 *
 * @param {Object} params
 * @param {string} params.eventLabel        e.g. "Ganeshotsav 2026"
 * @param {Array}  params.expenses          list of { expense_date, vendor_name, title, amount, amount_paid, payments }
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

  // Column layout — Date, Vendor Name, Title, Transaction ID, Estimated
  // Amount, Total Recorded Amount
  const cols = [
    { key: 'date', label: 'Date', width: 60 },
    { key: 'vendor', label: 'Vendor Name', width: 100 },
    { key: 'title', label: 'Title', width: 115 },
    { key: 'txn', label: 'Transaction ID', width: 95 },
    { key: 'estimated', label: 'Estimated Amt', width: 0 },
    { key: 'recorded', label: 'Recorded Amt', width: 0 }
  ]
  const remaining = usableWidth - (60 + 100 + 115 + 95)
  cols[4].width = remaining / 2
  cols[5].width = remaining / 2
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
      truncate(exp.vendor_name, 18),
      truncate(exp.title, 20),
      truncate(transactionIdsFor(exp), 16),
      formatAmount(exp.amount),
      formatAmount(exp.amount_paid)
    ]
    rowValues.forEach((val, i) => {
      page.drawText(String(val), { x: colX[i] + 4, y: y - 10, size: 8, font: fontRegular, color: BLACK })
    })
    y -= ROW_H
  })

  ensureSpace()
  y -= 10
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + usableWidth, y }, thickness: 1, color: LGRAY })
  y -= 18
  page.drawText(
    `Total Estimated: ${formatAmount(summary.total_amount)} · Total Recorded: ${formatAmount(summary.total_paid)} across ${summary.count} entr${summary.count === 1 ? 'y' : 'ies'}`,
    { x: MARGIN, y, size: 10, font: fontBold, color: BLACK }
  )

  return pdfDoc.save()
}
