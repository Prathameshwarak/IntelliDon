// lib/cache.ts
// Lightweight, high-performance in-memory cache with TTL and tag/prefix invalidation.

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL: number // in seconds

  constructor(defaultTTLSeconds = 60) {
    this.defaultTTL = defaultTTLSeconds
    // Periodic cleanup every 5 minutes to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTTL
    const expiresAt = Date.now() + ttl * 1000
    this.cache.set(key, { value, expiresAt })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Global cache instance
export const memoryCache = new InMemoryCache(60)

/**
 * Get item from cache or compute and cache it if absent or expired.
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  const cached = memoryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const result = await fetchFn()
  if (result !== undefined && result !== null) {
    memoryCache.set(key, result, ttlSeconds)
  }
  return result
}

export function invalidateCache(key: string): boolean {
  return memoryCache.delete(key)
}

export function invalidateCacheByPrefix(prefix: string): number {
  return memoryCache.invalidateByPrefix(prefix)
}
