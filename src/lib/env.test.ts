/**
 * Unit tests for environment variable helpers
 *
 * Tests that requireEnv enforces the presence of required configuration.
 */

import { requireEnv } from './env'

describe('env.ts - environment variable helpers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('requireEnv', () => {
    it('returns value when environment variable is set', () => {
      process.env.TEST_VAR = 'test-value'

      const result = requireEnv('TEST_VAR')

      expect(result).toBe('test-value')
    })

    it('throws error when environment variable is missing', () => {
      delete process.env.TEST_VAR

      expect(() => requireEnv('TEST_VAR')).toThrow('Missing TEST_VAR env var.')
    })

    it('throws error when environment variable is empty string', () => {
      process.env.TEST_VAR = ''

      expect(() => requireEnv('TEST_VAR')).toThrow('Missing TEST_VAR env var.')
    })

    it('preserves whitespace in values', () => {
      process.env.TEST_VAR = '  value with spaces  '

      const result = requireEnv('TEST_VAR')

      expect(result).toBe('  value with spaces  ')
    })
  })
})
