/**
 * Pure auth helper functions extracted for unit testing.
 *
 * These functions contain the core logic for token decoding and refresh decisions
 * without coupling to NextAuth internals.
 */

export type CognitoIdTokenPayload = {
  sub?: string
  email?: string
  exp?: number
}

/**
 * Decode a Cognito ID token JWT payload (without signature verification).
 *
 * This is safe for server-side use where we trust the token came from Cognito
 * via the auth flow. For client-side or untrusted sources, proper JWT verification
 * with signature checking would be required.
 *
 * @param token - The Cognito ID token (JWT)
 * @returns Parsed payload or null if malformed
 */
export function decodeIdTokenPayload(
  token: string
): CognitoIdTokenPayload | null {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    // JWT uses base64url encoding (replace - with + and _ with /)
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(normalized, 'base64').toString('utf8')
    return JSON.parse(json) as CognitoIdTokenPayload
  } catch {
    return null
  }
}

/**
 * Determine if a Cognito token should be refreshed based on expiry time.
 *
 * Uses a buffer to refresh tokens before they actually expire, reducing the
 * risk of using an expired token in flight.
 *
 * @param expiry - Token expiry timestamp (Unix seconds)
 * @param nowSeconds - Current time (Unix seconds)
 * @param bufferSeconds - How many seconds before expiry to trigger refresh (default 60)
 * @returns true if token should be refreshed
 */
export function shouldRefreshToken(
  expiry: number | undefined,
  nowSeconds: number,
  bufferSeconds: number = 60
): boolean {
  if (!expiry) return false
  return nowSeconds >= expiry - bufferSeconds
}

/**
 * Normalize user email for Cognito (lowercase + trim).
 *
 * Cognito usernames are case-sensitive, but we treat emails as case-insensitive
 * for better UX.
 *
 * @param email - Raw email input
 * @returns Normalized email
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
