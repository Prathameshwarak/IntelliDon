// lib/receiptData.js
export function buildReceiptData({ donation, mandal, event, collectorName }) {
  return {
    receiptNumber: donation.receipt_number,
    mandalName: mandal.name,
    mandalAddress: [mandal.address, mandal.city].filter(Boolean).join(', '),
    mandalPhone: mandal.phone,
    eventName: `${event.name} ${event.year}`,
    donorName: donation.donor_name,
    donorPhone: donation.donor_phone,
    donorAddress: donation.donor_address,
    amount: donation.amount,
    paymentMode: donation.payment_mode,
    createdAt: donation.created_at,
    collectedBy: collectorName || null,
    verified: true,
    verifiedByRole: donation.verification_type || null,
    verifiedAt: donation.verified_at || null
  }
}
