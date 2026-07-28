interface FailedAttemptRecord {
  timestamps: number[];
}

declare global {
  var __loginRateLimitStore: Map<string, FailedAttemptRecord> | undefined;
}

const rateLimitMap = globalThis.__loginRateLimitStore || new Map<string, FailedAttemptRecord>();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__loginRateLimitStore = rateLimitMap;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Clean up timestamps older than the 10-minute window for a specific key
 */
function cleanOldTimestamps(timestamps: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

/**
 * Check if the given IP + MAC/Device key is currently rate-limited due to unsuccessful login attempts.
 */
export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  failedCount: number;
  remainingSec: number;
  error?: string;
} {
  const record = rateLimitMap.get(key);
  if (!record || !record.timestamps || record.timestamps.length === 0) {
    return { allowed: true, failedCount: 0, remainingSec: 0 };
  }

  const validTimestamps = cleanOldTimestamps(record.timestamps);
  rateLimitMap.set(key, { timestamps: validTimestamps });

  if (validTimestamps.length >= MAX_FAILED_ATTEMPTS) {
    // Oldest attempt in the current 10-min window defines when the block resets
    const oldestTimestamp = validTimestamps[0];
    const expiryTime = oldestTimestamp + WINDOW_MS;
    const remainingMs = Math.max(0, expiryTime - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    const remainingMinutes = Math.ceil(remainingSec / 60);
    const timeLabel = remainingSec >= 60 ? `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}` : `${remainingSec} second${remainingSec !== 1 ? 's' : ''}`;

    return {
      allowed: false,
      failedCount: validTimestamps.length,
      remainingSec,
      error: `Too many failed attempts. Please try again in ${timeLabel}.`,
    };
  }

  return { allowed: true, failedCount: validTimestamps.length, remainingSec: 0 };
}

/**
 * Record an unsuccessful login attempt for the IP + MAC/Device key.
 */
export function recordFailedAttempt(key: string): number {
  const record = rateLimitMap.get(key);
  const currentTimestamps = cleanOldTimestamps(record?.timestamps || []);
  currentTimestamps.push(Date.now());
  rateLimitMap.set(key, { timestamps: currentTimestamps });
  return currentTimestamps.length;
}

/**
 * Reset/clear failed login attempt counter for the key upon successful login.
 */
export function resetFailedAttempts(key: string): void {
  rateLimitMap.delete(key);
}
