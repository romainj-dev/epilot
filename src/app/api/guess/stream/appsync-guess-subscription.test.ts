/**
 * Unit tests for guess subscription wiring
 *
 * NOTE: `ensureGuessSubscription` uses a module-level singleton client created
 * at import time. To reliably mock it, we mock the client module first, then
 * `require()` the module under test (instead of using static imports).
 */

import { GuessStatus } from '@/graphql/generated/graphql'

let mockSubscribe: jest.Mock

jest.mock('@/lib/appsync-realtime-client', () => ({
  AppSyncRealtimeClient: jest.fn(() => ({
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
  })),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ensureGuessSubscription } = require('./appsync-guess-subscription')

describe('appsync-guess-subscription', () => {
  beforeEach(() => {
    mockSubscribe = jest.fn().mockReturnValue({ stop: jest.fn() })

    process.env.APPSYNC_ENDPOINT =
      'https://test.appsync-api.us-east-1.amazonaws.com/graphql'
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.APPSYNC_ENDPOINT
  })

  it('configures subscription with Cognito auth and owner variable', () => {
    const owner = 'user-123'
    const idToken = 'cognito-token-abc'
    const onGuessUpdate = jest.fn()
    const onError = jest.fn()

    ensureGuessSubscription(owner, idToken, { onGuessUpdate, onError })

    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    const [config, , ownerParam] = mockSubscribe.mock.calls[0]

    // Check auth configuration
    expect(config.auth).toEqual({
      type: 'COGNITO_USER_POOLS',
      idToken,
    })

    // Check subscription configuration
    expect(config.subscription.operationName).toBe('OnUpdateGuess')
    expect(config.subscription.variables).toEqual({ owner })

    // Check owner parameter (per-user subscription)
    expect(ownerParam).toBe(owner)
  })

  it('filters data to pass SETTLED and FAILED guesses', () => {
    const owner = 'user-123'
    const idToken = 'test-token'
    const onGuessUpdate = jest.fn()

    ensureGuessSubscription(owner, idToken, { onGuessUpdate })

    const [config] = mockSubscribe.mock.calls[0]
    const { filterData } = config.subscription

    // Test filter function
    expect(filterData).toBeDefined()

    const settledGuess = {
      id: 'guess-1',
      owner,
      status: GuessStatus.Settled,
      direction: 'UP' as const,
      createdAt: '2026-01-01T00:00:00Z',
      settleAt: '2026-01-01T00:01:00Z',
      updatedAt: '2026-01-01T00:01:00Z',
    }

    const failedGuess = {
      ...settledGuess,
      status: GuessStatus.Failed,
    }

    const pendingGuess = {
      ...settledGuess,
      status: GuessStatus.Pending,
    }

    expect(filterData!(settledGuess)).toBe(true)
    expect(filterData!(failedGuess)).toBe(true)
    expect(filterData!(pendingGuess)).toBe(false)
  })

  it('validates guess data structure', () => {
    const owner = 'user-123'
    const idToken = 'test-token'
    const onGuessUpdate = jest.fn()

    ensureGuessSubscription(owner, idToken, { onGuessUpdate })

    const [config] = mockSubscribe.mock.calls[0]
    const { validateData } = config.subscription

    // Valid guess
    const validGuess = {
      id: 'guess-1',
      owner: 'user-123',
      createdAt: '2026-01-01T00:00:00Z',
      settleAt: '2026-01-01T00:01:00Z',
      direction: 'UP',
      status: 'SETTLED',
    }

    expect(validateData(validGuess)).toBe(true)

    // Invalid guess (missing required fields)
    expect(validateData(null)).toBe(false)
    expect(validateData({})).toBe(false)
    expect(validateData({ id: 'test' })).toBe(false)
  })

  it('wires callbacks correctly', () => {
    const owner = 'user-123'
    const idToken = 'test-token'
    const onGuessUpdate = jest.fn()
    const onError = jest.fn()

    ensureGuessSubscription(owner, idToken, { onGuessUpdate, onError })

    const [, callbacks] = mockSubscribe.mock.calls[0]

    expect(callbacks.onData).toBeDefined()
    expect(callbacks.onError).toBeDefined()

    // Test that onData maps to onGuessUpdate
    const testGuess = { id: 'test', owner: 'user-123' }
    callbacks.onData(testGuess)
    expect(onGuessUpdate).toHaveBeenCalledWith(testGuess)

    // Test that onError is forwarded
    const testError = new Error('Test error')
    callbacks.onError!(testError)
    expect(onError).toHaveBeenCalledWith(testError)
  })

  it('returns subscription handle with stop function', () => {
    const owner = 'user-123'
    const idToken = 'test-token'
    const mockStop = jest.fn()

    mockSubscribe.mockReturnValue({ stop: mockStop })

    const handle = ensureGuessSubscription(owner, idToken, {
      onGuessUpdate: jest.fn(),
    })

    expect(handle).toHaveProperty('stop')
    expect(typeof handle.stop).toBe('function')

    handle.stop()
    expect(mockStop).toHaveBeenCalled()
  })
})
