import { createClient } from '@supabase/supabase-js';

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

// Always attach to globalThis so in-memory store persists across module re-evaluations
const otpMap = globalThis.__otpStore || new Map<string, OTPRecord>();
globalThis.__otpStore = otpMap;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Check if an email address is allowed to request another OTP based on cooldown (2 mins / 120s).
 */
export async function canSendOTP(email: string, cooldownMs = 2 * 60 * 1000): Promise<{ allowed: boolean; remainingSec: number }> {
  const key = email.trim().toLowerCase();

  try {
    const { data, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('last_sent_at')
      .eq('email', key)
      .maybeSingle();

    if (!error && data && data.last_sent_at) {
      const lastSentTime = new Date(data.last_sent_at).getTime();
      const elapsed = Date.now() - lastSentTime;
      if (elapsed < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
        return { allowed: false, remainingSec };
      }
      return { allowed: true, remainingSec: 0 };
    }
  } catch (err) {
    console.warn('[otp-store] DB read error in canSendOTP, falling back to memory:', err);
  }

  // Memory fallback
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
export async function saveOTP(email: string, code: string, durationMs = 5 * 60 * 1000): Promise<void> {
  const key = email.trim().toLowerCase();
  const expiresAt = Date.now() + durationMs;
  const lastSentAt = Date.now();

  const existing = otpMap.get(key);
  const sendCount = (existing?.sendCount || 0) + 1;

  // Save to memory
  otpMap.set(key, {
    code,
    expiresAt,
    verified: false,
    lastSentAt,
    sendCount,
  });

  // Save to Supabase DB for cross-lambda / serverless persistence
  try {
    const { error } = await supabaseAdmin
      .from('otp_verifications')
      .upsert({
        email: key,
        code,
        expires_at: new Date(expiresAt).toISOString(),
        verified: false,
        last_sent_at: new Date(lastSentAt).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (error) {
      console.warn('[otp-store] Supabase DB upsert notice for otp_verifications:', error.message);
    }
  } catch (err) {
    console.warn('[otp-store] Failed DB write for OTP:', err);
  }
}

/**
 * Retrieve active OTP record for an email address.
 */
export async function getOTP(email: string): Promise<OTPRecord | undefined> {
  const key = email.trim().toLowerCase();

  try {
    const { data, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('code, expires_at, verified, last_sent_at')
      .eq('email', key)
      .maybeSingle();

    if (!error && data) {
      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() > expiresAt) {
        // Expired
        await supabaseAdmin.from('otp_verifications').delete().eq('email', key);
        otpMap.delete(key);
        return undefined;
      }

      return {
        code: data.code,
        expiresAt,
        verified: data.verified || false,
        lastSentAt: data.last_sent_at ? new Date(data.last_sent_at).getTime() : Date.now(),
        sendCount: 1,
      };
    }
  } catch (err) {
    console.warn('[otp-store] DB read error in getOTP, falling back to memory:', err);
  }

  // Memory fallback
  const record = otpMap.get(key);
  if (!record) return undefined;
  if (Date.now() > record.expiresAt) {
    otpMap.delete(key);
    return undefined;
  }
  return record;
}

/**
 * Mark an email address as verified.
 */
export async function markOTPVerified(email: string): Promise<void> {
  const key = email.trim().toLowerCase();

  // Update memory
  const record = otpMap.get(key);
  if (record) {
    record.verified = true;
    otpMap.set(key, record);
  }

  // Update Supabase DB
  try {
    await supabaseAdmin
      .from('otp_verifications')
      .update({ verified: true, updated_at: new Date().toISOString() })
      .eq('email', key);
  } catch (err) {
    console.warn('[otp-store] DB update error in markOTPVerified:', err);
  }
}

/**
 * Check if an email address has been verified.
 */
export async function isOTPVerified(email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();

  try {
    const { data, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('verified, expires_at')
      .eq('email', key)
      .maybeSingle();

    if (!error && data && data.verified === true) {
      return true;
    }
  } catch (err) {
    console.warn('[otp-store] DB read error in isOTPVerified, falling back to memory:', err);
  }

  // Memory fallback
  const record = otpMap.get(key);
  return record?.verified === true;
}
