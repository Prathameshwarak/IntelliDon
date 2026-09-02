// lib/resolveScreenshotUrl.js
// Server-only helper. Donation screenshots are stored in a private Supabase
// bucket, so displaying one requires a signed URL. Signed URLs expire, so we
// never persist one — the donation record stores the storage *path*, and a
// fresh, short-lived signed URL is minted here on every read, right before
// sending the donation data to the browser.
//
// Some existing rows (created before this fix) still hold a full signed URL
// instead of a bare path — `extractStoragePath` recovers the path from those
// so old records keep working without a data migration.

import { memoryCache } from './cache'

const BUCKET = 'payment-screenshots'
const SIGNED_URL_CACHE_TTL = 45 * 60 // 45 minutes in seconds

function extractStoragePath(storedValue) {
  if (!storedValue) return null
  if (!storedValue.startsWith('http')) return storedValue // already a bare path

  // Legacy value: a full (possibly expired) signed URL, e.g.
  // https://<project>.supabase.co/storage/v1/object/sign/payment-screenshots/<path>?token=...
  const marker = `/${BUCKET}/`
  const idx = storedValue.indexOf(marker)
  if (idx === -1) return null

  const afterBucket = storedValue.slice(idx + marker.length)
  const path = afterBucket.split('?')[0]
  return path ? decodeURIComponent(path) : null
}

// Mutates a copy of each donation row, replacing screenshot_url with a fresh
// signed URL (or null if it can't be resolved/signed).
async function resolveScreenshotUrls(supabaseAdmin, donations, expirySeconds = 60 * 60) {
  return Promise.all(
    donations.map(async (d) => {
      if (!d.screenshot_url) return d

      const path = extractStoragePath(d.screenshot_url)
      if (!path) return { ...d, screenshot_url: null }

      // Check in-memory cache for signed URL
      const cacheKey = `signed_url:${BUCKET}:${path}`
      const cachedUrl = memoryCache.get(cacheKey)
      if (cachedUrl) {
        return { ...d, screenshot_url: cachedUrl }
      }

      try {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, expirySeconds)

        if (error || !data) {
          console.error('Could not re-sign screenshot URL:', error)
          return { ...d, screenshot_url: null }
        }

        memoryCache.set(cacheKey, data.signedUrl, SIGNED_URL_CACHE_TTL)
        return { ...d, screenshot_url: data.signedUrl }
      } catch (err) {
        console.error('Unexpected error re-signing screenshot URL:', err)
        return { ...d, screenshot_url: null }
      }
    })
  )
}

export { resolveScreenshotUrls, extractStoragePath, BUCKET }

