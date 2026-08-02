'use client'
import { generateExpenseReportPDF } from './generateExpenseReportPDF'

export type ExpenseReportRow = {
  expense_date: string
  vendor_name: string
  vendor_phone: string | null
  title: string
  description: string | null
  amount: number
  transaction_id: string | null
  created_at: string
  created_by_name: string | null
  updated_at: string
}

export type ExpenseReportSummary = { total_amount: number; count: number }

export type ExpenseReportFormat = 'pdf' | 'excel'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function csvEscape(v: string | number) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function buildExcelBlob(expenses: ExpenseReportRow[]): Blob {
  const headerRow = ['Expense Date', 'Vendor Name', 'Vendor Phone', 'Title', 'Description', 'Amount', 'Transaction ID', 'Created At', 'Created By', 'Updated At']
  const lines = [headerRow.map(csvEscape).join(',')]
  for (const e of expenses) {
    lines.push([
      formatDate(e.expense_date),
      e.vendor_name,
      e.vendor_phone || '',
      e.title,
      e.description || '',
      e.amount,
      e.transaction_id || '',
      new Date(e.created_at).toLocaleString('en-IN'),
      e.created_by_name || '',
      new Date(e.updated_at).toLocaleString('en-IN')
    ].map(csvEscape).join(','))
  }
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
}

async function buildPdfBlob(eventLabel: string, expenses: ExpenseReportRow[], summary: ExpenseReportSummary): Promise<Blob> {
  const pdfBytes = await generateExpenseReportPDF({ eventLabel, expenses, summary })
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

async function buildReportBlob(format: ExpenseReportFormat, eventLabel: string, expenses: ExpenseReportRow[], summary: ExpenseReportSummary): Promise<Blob> {
  return format === 'pdf' ? buildPdfBlob(eventLabel, expenses, summary) : buildExcelBlob(expenses)
}

function fileNameFor(format: ExpenseReportFormat, eventLabel: string) {
  const base = `Expenses-${eventLabel.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}`
  return format === 'pdf' ? `${base}.pdf` : `${base}.csv`
}

// Saves the file straight to the device — never opens a preview window/tab.
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

export async function downloadExpenseReport(
  format: ExpenseReportFormat,
  eventLabel: string,
  expenses: ExpenseReportRow[],
  summary: ExpenseReportSummary
) {
  const blob = await buildReportBlob(format, eventLabel, expenses, summary)
  triggerDownload(blob, fileNameFor(format, eventLabel))
}

export async function shareExpenseReport(
  format: ExpenseReportFormat,
  eventLabel: string,
  expenses: ExpenseReportRow[],
  summary: ExpenseReportSummary
) {
  const fileName = fileNameFor(format, eventLabel)
  const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv'

  let blob: Blob
  try {
    blob = await buildReportBlob(format, eventLabel, expenses, summary)
  } catch (err) {
    console.error('Failed to generate expense report:', err)
    return
  }

  // Everything below (including the canShare capability check) is wrapped in
  // try/catch — some browsers throw rather than return false when the
  // ShareData shape isn't supported, which would otherwise silently break
  // the click handler. Same pattern as lib/downloadReceipt.ts.
  try {
    const file = new File([blob], fileName, { type: mimeType })

    const shareData: ShareData = {
      files: [file],
      title: `Expense Report — ${eventLabel}`,
      text: `Expense report for ${eventLabel} (${summary.count} entries)`
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
