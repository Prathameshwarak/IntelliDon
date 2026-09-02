// lib/auth-cache.ts
// Caches Supabase authentication token verification & user profile lookups in memory
// to avoid making 2 remote network calls on every single API request.

import { memoryCache } from './cache'

export interface AuthProfile {
  id: string
  role: string
  mandal_id: string | null
  full_name: string | null
  [key: string]: any
}

export interface AuthSuccessResult {
  user: any
  profile: AuthProfile | null
  token: string
}

export interface AuthErrorResult {
  error: string
  status: number
}

export type AuthResult = AuthSuccessResult | AuthErrorResult

export function isAuthError(result: AuthResult): result is AuthErrorResult {
  return 'error' in result
}

/**
 * Validates Bearer token and returns authenticated user and profile with in-memory TTL caching.
 */
export async function getCachedAuthUserAndProfile(
  request: Request,
  supabaseAdmin: any,
  ttlSeconds = 60
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or invalid token', status: 401 }
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return { error: 'Unauthorized: Missing token', status: 401 }
  }

  const cacheKey = `auth_session:${token}`
  const cached = memoryCache.get<{ user: any; profile: AuthProfile | null }>(cacheKey)

  if (cached) {
    return {
      user: cached.user,
      profile: cached.profile,
      token
    }
  }

  // Verify token via Supabase Auth
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Unauthorized: Invalid session', status: 401 }
  }

  // Fetch user profile from database
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, role, mandal_id, full_name')
    .eq('id', user.id)
    .single()

  const sessionData = { user, profile: profile || null }
  memoryCache.set(cacheKey, sessionData, ttlSeconds)

  return {
    user,
    profile: profile || null,
    token
  }
}

/**
 * Invalidates the cached auth session for a specific token or user.
 */
export function invalidateAuthSession(token: string): void {
  if (token) {
    memoryCache.delete(`auth_session:${token}`)
  }
}
