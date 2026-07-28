export interface OTPRecord {
  code: string;
  expiresAt: number;
  verified: boolean;
  lastSentAt: number;
  sendCount: number;
}

declare global {
  var __otpStore: Map<string, OTPRecord> | undefined;
}

const otpMap = globalThis.__otpStore || new Map<string, OTPRecord>();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__otpStore = otpMap;
}

/**
 * Check if an email address is allowed to request another OTP based on cooldown (2 mins / 120s).
 */
export function canSendOTP(email: string, cooldownMs = 2 * 60 * 1000): { allowed: boolean; remainingSec: number } {
  const key = email.trim().toLowerCase();
  const record = otpMap.get(key);
  if (!record || !record.lastSentAt) {
    return { allowed: true, remainingSec: 0 };
  }
  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < cooldownMs) {
    const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
    return { allowed: false, remainingSec };
  }
  return { allowed: true, remainingSec: 0 };
}

/**
 * Store a 6-digit OTP for an email address with expiry and lastSentAt timestamp.
 */
export function saveOTP(email: string, code: string, durationMs = 5 * 60 * 1000): void {
  const key = email.trim().toLowerCase();
  const existing = otpMap.get(key);
  const sendCount = (existing?.sendCount || 0) + 1;
  otpMap.set(key, {
    code,
    expiresAt: Date.now() + durationMs,
    verified: false,
    lastSentAt: Date.now(),
    sendCount,
  });
}

/**
 * Retrieve active OTP record for an email address.
 */
export function getOTP(email: string): OTPRecord | undefined {
  const key = email.trim().toLowerCase();
  const record = otpMap.get(key);
  if (!record) return undefined;
  if (Date.now() > record.expiresAt) {
    otpMap.delete(key);
    return undefined;
  }
  return record;
}

/**
 * Mark an email address as verified (valid for 30 minutes to complete registration).
 */
export function markOTPVerified(email: string): void {
  const key = email.trim().toLowerCase();
  const existing = otpMap.get(key);
  otpMap.set(key, {
    code: '',
    expiresAt: Date.now() + 30 * 60 * 1000,
    verified: true,
    lastSentAt: existing?.lastSentAt || Date.now(),
    sendCount: existing?.sendCount || 1,
  });
}

/**
 * Check if an email address has completed OTP verification.
 */
export function isOTPVerified(email: string): boolean {
  const key = email.trim().toLowerCase();
  const record = otpMap.get(key);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpMap.delete(key);
    return false;
  }
  return record.verified === true;
}

/**
 * Delete an OTP record for an email.
 */
export function deleteOTP(email: string): void {
  const key = email.trim().toLowerCase();
  otpMap.delete(key);
}
