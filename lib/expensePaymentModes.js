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
