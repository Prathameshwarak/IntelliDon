// lib/receiptData.js

export function generateReceiptCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function buildReceiptData({ donation, mandal, event, collectorName, logoUrl }) {
  const receiptCode =
    donation.receipt_code ||
    donation.receiptCode ||
    donation.receipt_data?.receiptCode ||
    generateReceiptCode()

  return {
    receiptNumber: donation.receipt_number,
    receiptCode,
    mandalName: mandal.name,
    mandalAddress: [mandal.address, mandal.city].filter(Boolean).join(', '),
    mandalPhone: mandal.phone,
    mandalLogo: logoUrl || mandal.logo_url || mandal.doc_logo || null,
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

