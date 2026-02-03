/**
 * Unit tests for auth helper functions
 *
 * Tests token decoding, refresh decision logic, and email normalization
 * without coupling to NextAuth internals.
 */

import {
  decodeIdTokenPayload,
  shouldRefreshToken,
  normalizeEmail,
} from './auth-helpers'

describe('auth-helpers', () => {
  describe('decodeIdTokenPayload', () => {
    it('decodes valid JWT payload', () => {
      // Create a simple JWT: header.payload.signature
      // Payload: {"sub":"user-123","email":"test@example.com","exp":1234567890}
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        exp: 1234567890,
      }
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64'
      )
      const token = `header.${encodedPayload}.signature`

      const result = decodeIdTokenPayload(token)

      expect(result).toEqual(payload)
    })

    it('handles base64url encoding (- and _ characters)', () => {
      // JWT uses base64url: - instead of +, _ instead of /
      const payload = { sub: 'test-user_123', email: 'test@example.com' }
      const base64 = Buffer.from(JSON.stringify(payload)).toString('base64')
      // Convert to base64url format
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_')
      const token = `header.${base64url}.signature`

      const result = decodeIdTokenPayload(token)

      expect(result).toEqual(payload)
    })

    it('returns null for malformed token (missing payload)', () => {
      const token = 'header..signature' // Empty payload

      const result = decodeIdTokenPayload(token)

      expect(result).toBeNull()
    })

    it('returns null for token with invalid base64', () => {
      const token = 'header.!!!invalid-base64!!!.signature'

      const result = decodeIdTokenPayload(token)

      expect(result).toBeNull()
    })

    it('returns null for token with invalid JSON', () => {
      const invalidJson = Buffer.from('not valid json {').toString('base64')
      const token = `header.${invalidJson}.signature`

      const result = decodeIdTokenPayload(token)

      expect(result).toBeNull()
    })

    it('returns null for token without dots', () => {
      const token = 'not-a-jwt-token'

      const result = decodeIdTokenPayload(token)

      expect(result).toBeNull()
    })
  })

  describe('shouldRefreshToken', () => {
    it('returns true when current time exceeds expiry minus buffer', () => {
      const expiry = 1000
      const now = 941 // 1000 - 60 + 1 (past the refresh threshold)

      const result = shouldRefreshToken(expiry, now, 60)

      expect(result).toBe(true)
    })

    it('returns true when current time equals expiry minus buffer', () => {
      const expiry = 1000
      const now = 940 // Exactly at 1000 - 60

      const result = shouldRefreshToken(expiry, now, 60)

      expect(result).toBe(true)
    })

    it('returns false when current time is before expiry minus buffer', () => {
      const expiry = 1000
      const now = 939 // Still 1 second before threshold

      const result = shouldRefreshToken(expiry, now, 60)

      expect(result).toBe(false)
    })

    it('returns false when expiry is undefined', () => {
      const now = Date.now()

      const result = shouldRefreshToken(undefined, now, 60)

      expect(result).toBe(false)
    })

    it('uses default 60 second buffer when not specified', () => {
      const expiry = 2000
      const now = 1940 // Exactly 60 seconds before expiry

      const result = shouldRefreshToken(expiry, now)

      expect(result).toBe(true)
    })

    it('supports custom buffer values', () => {
      const expiry = 1000
      const now = 879 // used to distinguish thresholds for 120s vs 121s buffers

      // Threshold with 120s buffer is 880; now=879 is before threshold => should NOT refresh
      expect(shouldRefreshToken(expiry, now, 120)).toBe(false)

      // Threshold with 121s buffer is 879; now=879 is at threshold => should refresh
      expect(shouldRefreshToken(expiry, now, 121)).toBe(true)
    })
  })

  describe('normalizeEmail', () => {
    it('converts email to lowercase', () => {
      const result = normalizeEmail('Test@Example.COM')

      expect(result).toBe('test@example.com')
    })

    it('trims leading and trailing whitespace', () => {
      const result = normalizeEmail('  test@example.com  ')

      expect(result).toBe('test@example.com')
    })

    it('handles email with both uppercase and whitespace', () => {
      const result = normalizeEmail('  Test.User@Example.COM  ')

      expect(result).toBe('test.user@example.com')
    })

    it('preserves already normalized emails', () => {
      const result = normalizeEmail('test@example.com')

      expect(result).toBe('test@example.com')
    })

    it('handles emails with special characters correctly', () => {
      const result = normalizeEmail('  Test+User_123@Example.COM  ')

      expect(result).toBe('test+user_123@example.com')
    })
  })
})
