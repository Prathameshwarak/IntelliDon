// lib/sponsorValidation.js
// Shared between app/api/sponsors/route.js (create) and
// app/api/sponsors/[id]/route.js (edit) so validation rules can't drift.

export const SPONSOR_TYPES = ['finance', 'goods_service', 'ads_package']
export const PACKAGES = ['title', 'platinum', 'gold', 'silver', 'supporting', 'others']

// GST format: 2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[0-9]{10}$/
const NINE_DIGIT_REGEX = /^[0-9]{1,9}$/

function tooLong(value, max) {
  return typeof value === 'string' && value.trim().length > max
}

// Returns an error string, or null if the payload is valid.
export function validateSponsorPayload(body) {
  const {
    company_name, reference_name, contact_person_name, contact_person_phone,
    email, address, gst_no,
    sponsor_type, package: pkg, package_name,
    committed_amount, contribution_date,
    weight, quantity, estimated_value, goods_service_description,
    notes
  } = body

  if (!company_name || !company_name.trim()) {
    return 'Company/Business Name is required'
  }
  if (tooLong(company_name, 75)) return 'Company/Business Name must be 75 characters or fewer'
  if (tooLong(contact_person_name, 50)) return 'Contact Person must be 50 characters or fewer'
  if (tooLong(address, 100)) return 'Address must be 100 characters or fewer'
  if (tooLong(reference_name, 50)) return 'Reference Name must be 50 characters or fewer'
  if (tooLong(notes, 100)) return 'Note must be 100 characters or fewer'

  if (contact_person_phone && !PHONE_REGEX.test(contact_person_phone.trim())) {
    return 'Enter a valid 10-digit phone number'
  }
  if (email && !EMAIL_REGEX.test(email.trim())) {
    return 'Enter a valid email address'
  }
  if (gst_no && gst_no.trim() && !GST_REGEX.test(gst_no.trim().toUpperCase())) {
    return 'Enter a valid GST number'
  }

  if (sponsor_type && !SPONSOR_TYPES.includes(sponsor_type)) {
    return 'Invalid sponsor type'
  }

  if (sponsor_type === 'finance' || sponsor_type === 'ads_package') {
    if (!committed_amount) {
      return 'Committed Amount is required'
    }
    if (!NINE_DIGIT_REGEX.test(String(committed_amount))) {
      return 'Committed Amount must be a number up to 9 digits'
    }
    if (!contribution_date) {
      return 'Date is required'
    }
  }

  if (sponsor_type === 'ads_package') {
    if (pkg && !PACKAGES.includes(pkg)) return 'Invalid package type'
    if (pkg === 'others' && tooLong(package_name, 75)) return 'Package Name must be 75 characters or fewer'
    if (pkg === 'others' && (!package_name || !package_name.trim())) return 'Package Name is required when Package Type is Others'
  } else if (pkg) {
    return 'Package Type only applies to Ads Package sponsors'
  }

  if (sponsor_type === 'goods_service') {
    if (!goods_service_description || !goods_service_description.trim()) return 'Goods/Service Name is required'
    if (tooLong(goods_service_description, 75)) return 'Goods/Service Name must be 75 characters or fewer'
    if (!weight || !weight.trim()) return 'Weight is required'
    if (tooLong(weight, 10)) return 'Weight must be 10 characters or fewer'
    if (!quantity) return 'Quantity is required'
    if (!NINE_DIGIT_REGEX.test(String(quantity))) return 'Quantity must be a number up to 9 digits'
    if (estimated_value !== undefined && estimated_value !== null && estimated_value !== '') {
      if (!NINE_DIGIT_REGEX.test(String(estimated_value))) return 'Estimated Value must be a number up to 9 digits'
    }
  }

  return null
}

// Given a validated payload, returns the exact set of columns to persist —
// clearing out fields that don't apply to the selected sponsor_type so stale
// data from a previous type never lingers on the row.
export function buildSponsorColumns(body) {
  const {
    company_name, reference_name, contact_person_name, contact_person_phone, email, address, gst_no,
    sponsor_type, package: pkg, package_name,
    committed_amount, contribution_date,
    weight, quantity, estimated_value, goods_service_description,
    notes
  } = body

  const isFinance = sponsor_type === 'finance'
  const isGoods = sponsor_type === 'goods_service'
  const isAds = sponsor_type === 'ads_package'

  // contribution_type only exists to satisfy the sponsors table's NOT NULL
  // constraint — it isn't user-facing.
  const contribution_type = isGoods ? 'goods' : 'cash'

  return {
    company_name: company_name.trim(),
    reference_name: reference_name?.trim() || null,
    contact_person_name: contact_person_name?.trim() || null,
    contact_person_phone: contact_person_phone?.trim() || null,
    email: email?.trim().toLowerCase() || null,
    address: address?.trim() || null,
    gst_no: gst_no?.trim().toUpperCase() || null,
    sponsor_type: sponsor_type || null,
    package: isAds ? (pkg || null) : null,
    package_name: isAds && pkg === 'others' ? (package_name?.trim() || null) : null,
    contribution_type,
    // Finance / Ads Package share committed_amount + date
    committed_amount: (isFinance || isAds) && committed_amount ? Number(committed_amount) : 0,
    contribution_date: (isFinance || isAds) ? (contribution_date || null) : null,
    // Goods/Service-only
    weight: isGoods ? (weight?.trim() || null) : null,
    quantity: isGoods && quantity ? Number(quantity) : null,
    estimated_value: isGoods && estimated_value ? Number(estimated_value) : null,
    goods_service_description: isGoods ? (goods_service_description?.trim() || null) : null,
    // Shared
    notes: notes?.trim() || null
  }
}
