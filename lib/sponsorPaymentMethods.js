// lib/sponsorPaymentMethods.js
// The allowed set of payment methods for recording a Sponsor Payment
// (installment). Shared between the frontend dropdown and the backend
// validation so they can't drift apart.

export const SPONSOR_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'goods_services', label: 'Goods/Services' },
  { value: 'other', label: 'Other' }
]

export const SPONSOR_PAYMENT_METHOD_VALUES = SPONSOR_PAYMENT_METHODS.map(m => m.value)

// 3-hour edit window for correcting a sponsor payment entry.
export const PAYMENT_EDIT_WINDOW_MS = 3 * 60 * 60 * 1000
