/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Unit tests for price snapshot subscription wiring
 *
 * NOTE: `ensurePriceSnapshotSubscription` uses a module-level singleton client
 * created at import time. To reliably mock it, we mock the client module first,
 * then `require()` the module under test (instead of using static imports).
 */

let mockSubscribe: jest.Mock

jest.mock('@/lib/appsync-realtime-client', () => ({
  AppSyncRealtimeClient: jest.fn(() => ({
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
  })),
}))

const {
  ensurePriceSnapshotSubscription,
} = require('./appsync-price-snapshot-subscription')

describe('appsync-price-snapshot-subscription', () => {
  beforeEach(() => {
    mockSubscribe = jest.fn().mockReturnValue({ stop: jest.fn() })

    process.env.APPSYNC_ENDPOINT =
      'https://test.appsync-api.us-east-1.amazonaws.com/graphql'
    process.env.APPSYNC_API_KEY = 'test-api-key-12345'
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.APPSYNC_ENDPOINT
    delete process.env.APPSYNC_API_KEY
  })

  it('configures subscription with API key auth', () => {
    const onSnapshot = jest.fn()
    const onError = jest.fn()

    ensurePriceSnapshotSubscription({ onSnapshot, onError })

    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    const [config] = mockSubscribe.mock.calls[0]

    // Check auth configuration uses API key
    expect(config.auth).toEqual({
      type: 'API_KEY',
      apiKey: 'test-api-key-12345',
    })
  })

  it('configures subscription with correct operation and variables', () => {
    const onSnapshot = jest.fn()

    ensurePriceSnapshotSubscription({ onSnapshot })

    const [config] = mockSubscribe.mock.calls[0]

    // Check subscription configuration
    expect(config.subscription.operationName).toBe('OnCreatePriceSnapshot')
    expect(config.subscription.variables).toEqual({
      filter: {
        pk: { eq: 'PriceSnapshot' },
      },
    })
  })

  it('uses null owner for global subscription', () => {
    const onSnapshot = jest.fn()

    ensurePriceSnapshotSubscription({ onSnapshot })

    const [, , ownerParam] = mockSubscribe.mock.calls[0]

    // Should use null for global subscription (shared across all users)
    expect(ownerParam).toBeNull()
  })

  it('validates price snapshot data structure', () => {
    const onSnapshot = jest.fn()

    ensurePriceSnapshotSubscription({ onSnapshot })

    const [config] = mockSubscribe.mock.calls[0]
    const { validateData } = config.subscription

    // Valid snapshot
    const validSnapshot = {
      id: 'snap-123',
      pk: 'PriceSnapshot',
      capturedAt: '2026-01-01T00:00:00Z',
      priceUsd: 50000.0,
    }

    expect(validateData(validSnapshot)).toBe(true)

    // Valid snapshot with optional fields
    const snapshotWithOptionals = {
      ...validSnapshot,
      sourceUpdatedAt: '2026-01-01T00:00:00Z',
      source: 'coinbase',
    }

    expect(validateData(snapshotWithOptionals)).toBe(true)

    // Invalid snapshots
    expect(validateData(null)).toBe(false)
    expect(validateData({})).toBe(false)
    expect(validateData({ id: 'test' })).toBe(false)
    expect(
      validateData({ id: 'test', pk: 'test', priceUsd: 'not-a-number' })
    ).toBe(false)
  })

  it('wires callbacks correctly', () => {
    const onSnapshot = jest.fn()
    const onError = jest.fn()

    ensurePriceSnapshotSubscription({ onSnapshot, onError })

    const [, callbacks] = mockSubscribe.mock.calls[0]

    expect(callbacks.onData).toBeDefined()
    expect(callbacks.onError).toBeDefined()

    // Test that onData maps to onSnapshot
    const testSnapshot = {
      id: 'snap-123',
      pk: 'PriceSnapshot',
      capturedAt: '2026-01-01T00:00:00Z',
      priceUsd: 50000.0,
    }
    callbacks.onData(testSnapshot)
    expect(onSnapshot).toHaveBeenCalledWith(testSnapshot)

    // Test that onError is forwarded
    const testError = new Error('Connection failed')
    callbacks.onError!(testError)
    expect(onError).toHaveBeenCalledWith(testError)
  })

  it('returns subscription handle with stop function', () => {
    const mockStop = jest.fn()
    mockSubscribe.mockReturnValue({ stop: mockStop })

    const handle = ensurePriceSnapshotSubscription({
      onSnapshot: jest.fn(),
    })

    expect(handle).toHaveProperty('stop')
    expect(typeof handle.stop).toBe('function')

    handle.stop()
    expect(mockStop).toHaveBeenCalled()
  })
})
