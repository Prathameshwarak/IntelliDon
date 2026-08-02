// lib/expensePaymentModes.js
// The allowed set of payment modes for how an expense was paid.
// Backed by the *existing* `expense_payments.payment_mode` column/check
// constraint (cash | upi | bank_transfer | cheque | other) — no schema
// change required. Shared between the frontend dropdown and the backend
// validation so they can't drift apart.

export const EXPENSE_PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' }
]

export const EXPENSE_PAYMENT_MODE_VALUES = EXPENSE_PAYMENT_MODES.map(m => m.value)

export function expensePaymentModeLabel(value) {
  if (!value) return 'Not specified'
  return EXPENSE_PAYMENT_MODES.find(m => m.value === value)?.label || value
}

// 3-hour edit window for correcting an expense payment (installment) entry —
// mirrors PAYMENT_EDIT_WINDOW_MS in lib/sponsorPaymentMethods.js.
export const EXPENSE_PAYMENT_EDIT_WINDOW_MS = 3 * 60 * 60 * 1000

// ── Monetary precision (shared by every expense amount/payment amount) ──
// Up to 9 integer digits (matches the existing MAX_AMOUNT digit cap) with
// an optional fractional part of *exactly* up to 2 decimal places.
export const EXPENSE_AMOUNT_REGEX = /^\d{1,9}(\.\d{1,2})?$/

// Rounds to exactly 2 decimal places using a cent-safe integer round (avoids
// classic floating-point drift like 19.999999999998).
export function roundToTwoDecimals(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

// Returns an error string, or null if the amount is a valid positive value
// with at most 2 decimal places.
export function validateExpenseAmount(value) {
  if (value === undefined || value === null || value === '' || isNaN(value) || Number(value) <= 0) {
    return 'Amount must be a positive number'
  }
  if (!EXPENSE_AMOUNT_REGEX.test(String(value).trim())) {
    return 'Amount can have at most 2 decimal places'
  }
  return null
}

// ₹ formatting to exactly 2 decimal places — used everywhere a monetary
// value is displayed in the Expense Management UI or exported reports.
export function formatExpenseAmount(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
