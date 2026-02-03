// Mock lambda-utils before requiring the handler
jest.mock('lambda-utils', () => ({
  ssm: {
    getCachedParameterOrNull: jest.fn(),
  },
  appsync: {
    makeAppSyncRequest: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const { handler } = require('../index')
const { ssm, appsync, logger } = require('lambda-utils')

// Shared test constants
const MOCK_ENDPOINT = 'https://mock-appsync.amazonaws.com/graphql'
const MOCK_API_KEY = 'da2-mockApiKey123'

// Helper to setup SSM mocks consistently across test suites
const setupSSMMocks = () => {
  ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
    if (path.includes('endpoint')) return MOCK_ENDPOINT
    if (path.includes('api-key')) return MOCK_API_KEY
    return null
  })
}

describe('settleGuessLambda handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APPSYNC_ENDPOINT_SSM_PATH = '/epilot/dev/appsync-endpoint'
    process.env.APPSYNC_API_KEY_SSM_PATH = '/epilot/dev/appsync-api-key'
    setupSSMMocks()
  })

  afterEach(() => {
    delete process.env.APPSYNC_ENDPOINT_SSM_PATH
    delete process.env.APPSYNC_API_KEY_SSM_PATH
  })

  it('returns early when guessId is missing', async () => {
    await handler({})
    expect(logger.error).toHaveBeenCalledWith(
      'Missing guessId in event',
      expect.any(Object)
    )
    expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled()
  })

  it('marks guess FAILED when snapshots cannot be resolved', async () => {
    appsync.makeAppSyncRequest
      // fetchGuess
      .mockResolvedValueOnce({
        data: {
          getGuess: {
            id: 'g1',
            owner: 'sub-1',
            createdAt: new Date().toISOString(),
            settleAt: new Date(Date.now() + 60000).toISOString(),
            direction: 'UP',
            status: 'PENDING',
          },
        },
      })
      // resolveSnapshot(start)
      .mockResolvedValueOnce({
        data: { priceSnapshotsBySourceUpdatedAt: { items: [] } },
      })
      // resolveSnapshot(end)
      .mockResolvedValueOnce({
        data: { priceSnapshotsBySourceUpdatedAt: { items: [] } },
      })
      // markGuessFailed(updateGuess)
      .mockResolvedValueOnce({ data: { updateGuess: { id: 'g1', status: 'FAILED' } } })

    await handler({ guessId: 'g1' })

    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: MOCK_ENDPOINT,
        apiKey: MOCK_API_KEY,
        query: expect.stringContaining('query GetGuess'),
      })
    )

    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('mutation FailGuess'),
        variables: { input: { id: 'g1', status: 'FAILED' } },
      })
    )
  })

  it('settles guess and updates user score using getUserState', async () => {
    const createdAt = new Date().toISOString()
    const settleAt = new Date(Date.now() + 60000).toISOString()

    // Define expected sequence of calls with clear intent
    const mockResponses = [
      // 1. fetchGuess
      {
        data: {
          getGuess: {
            id: 'g2',
            owner: 'sub-2',
            createdAt,
            settleAt,
            direction: 'UP',
            status: 'PENDING',
          },
        },
      },
      // 2. resolveSnapshot(start) -> price 100
      {
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      },
      // 3. resolveSnapshot(end) -> price 110 => UP => WIN => +1
      {
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-end', priceUsd: 110, sourceUpdatedAt: settleAt }],
          },
        },
      },
      // 4. settleGuess(updateGuess)
      {
        data: {
          updateGuess: { id: 'g2', status: 'SETTLED' },
        },
      },
      // 5. getUserState
      {
        data: {
          getUserState: { id: 'sub-2', score: 5 },
        },
      },
      // 6. updateUserState
      {
        data: {
          updateUserState: { id: 'sub-2', score: 6 },
        },
      },
    ]

    let callIndex = 0
    appsync.makeAppSyncRequest.mockImplementation(async () => {
      if (callIndex >= mockResponses.length) {
        throw new Error(`Unexpected call #${callIndex + 1} to makeAppSyncRequest`)
      }
      return mockResponses[callIndex++]
    })

    await handler({ guessId: 'g2' })

    // Verify all expected calls were made
    expect(appsync.makeAppSyncRequest).toHaveBeenCalledTimes(6)

    // Verify snapshot resolution uses 'le' (less than or equal) to get latest snapshot BEFORE target
    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('sortDirection: DESC'),
        variables: expect.objectContaining({
          pk: 'PriceSnapshot',
          sourceUpdatedAt: { le: createdAt },
          limit: 1,
        }),
      })
    )

    // ensure we used getUserState (not listUserStates)
    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('query GetUserState'),
        variables: { id: 'sub-2' },
      })
    )

    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('mutation UpdateScore'),
        variables: expect.objectContaining({
          input: expect.objectContaining({
            id: 'sub-2',
            score: 6,
          }),
        }),
      })
    )
  })
})

describe('resolveEndSnapshot edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    process.env.APPSYNC_ENDPOINT_SSM_PATH = '/epilot/dev/appsync-endpoint'
    process.env.APPSYNC_API_KEY_SSM_PATH = '/epilot/dev/appsync-api-key'
    setupSSMMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
    delete process.env.APPSYNC_ENDPOINT_SSM_PATH
    delete process.env.APPSYNC_API_KEY_SSM_PATH
  })

  it('settles immediately when end snapshot is fresh (gap < 57s)', async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const settleAt = new Date(now + 60_000).toISOString()
    // Snapshot from 30s before settleAt => gap = 30s < 57s => fresh
    const endSnapshotSourceUpdatedAt = new Date(now + 30_000).toISOString()

    appsync.makeAppSyncRequest
      .mockResolvedValueOnce({
        data: {
          getGuess: {
            id: 'g1',
            owner: 'sub-1',
            createdAt,
            settleAt,
            direction: 'UP',
            status: 'PENDING',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-end', priceUsd: 110, sourceUpdatedAt: endSnapshotSourceUpdatedAt }],
          },
        },
      })
      .mockResolvedValueOnce({ data: { updateGuess: { id: 'g1', status: 'SETTLED' } } })
      .mockResolvedValueOnce({ data: { getUserState: { id: 'sub-1', score: 0 } } })
      .mockResolvedValueOnce({ data: { updateUserState: { id: 'sub-1', score: 1 } } })

    const resultPromise = handler({ guessId: 'g1' })
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.outcome).toBe('WIN')
    // Should NOT have logged stale snapshot message (no retry)
    expect(logger.info).not.toHaveBeenCalledWith(
      'End snapshot appears stale, waiting for newer data...',
      expect.any(Object)
    )
  })

  it('retries when end snapshot is stale (gap >= 57s) and uses newer snapshot', async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const settleAt = new Date(now + 60_000).toISOString()
    // Stale snapshot: 60s before settleAt => gap = 60s >= 57s
    const staleSourceUpdatedAt = new Date(now).toISOString()
    // Fresh snapshot: 30s before settleAt => valid
    const freshSourceUpdatedAt = new Date(now + 30_000).toISOString()

    appsync.makeAppSyncRequest
      .mockResolvedValueOnce({
        data: {
          getGuess: {
            id: 'g2',
            owner: 'sub-2',
            createdAt,
            settleAt,
            direction: 'DOWN',
            status: 'PENDING',
          },
        },
      })
      // resolveSnapshot(start)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      })
      // resolveEndSnapshot - first fetch (stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 1 (fresh snapshot arrives)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-fresh', priceUsd: 90, sourceUpdatedAt: freshSourceUpdatedAt }],
          },
        },
      })
      .mockResolvedValueOnce({ data: { updateGuess: { id: 'g2', status: 'SETTLED' } } })
      .mockResolvedValueOnce({ data: { getUserState: { id: 'sub-2', score: 0 } } })
      .mockResolvedValueOnce({ data: { updateUserState: { id: 'sub-2', score: 1 } } })

    const resultPromise = handler({ guessId: 'g2' })
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.endPrice).toBe(90) // Used the fresh snapshot
    expect(result.outcome).toBe('WIN') // Price went DOWN, guessed DOWN => WIN
    expect(logger.info).toHaveBeenCalledWith(
      'End snapshot appears stale, waiting for newer data...',
      expect.objectContaining({ gapMs: expect.any(Number) })
    )
    expect(logger.info).toHaveBeenCalledWith(
      'Newer snapshot found',
      expect.objectContaining({ attempt: 1 })
    )
  })

  it('uses original snapshot when newer snapshot has sourceUpdatedAt > settleAt', async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const settleAt = new Date(now + 60_000).toISOString()
    // Stale snapshot: 60s before settleAt
    const staleSourceUpdatedAt = new Date(now).toISOString()
    // New snapshot arrives but is AFTER settleAt (CoinGecko slow then caught up)
    const tooNewSourceUpdatedAt = new Date(now + 61_000).toISOString()

    appsync.makeAppSyncRequest
      .mockResolvedValueOnce({
        data: {
          getGuess: {
            id: 'g3',
            owner: 'sub-3',
            createdAt,
            settleAt,
            direction: 'UP',
            status: 'PENDING',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      })
      // resolveEndSnapshot - first fetch (stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 1 (new snapshot but too new)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-too-new', priceUsd: 120, sourceUpdatedAt: tooNewSourceUpdatedAt }],
          },
        },
      })
      .mockResolvedValueOnce({ data: { updateGuess: { id: 'g3', status: 'SETTLED' } } })
      .mockResolvedValueOnce({ data: { getUserState: { id: 'sub-3', score: 0 } } })
      .mockResolvedValueOnce({ data: { updateUserState: { id: 'sub-3', score: 0 } } })

    const resultPromise = handler({ guessId: 'g3' })
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.endPrice).toBe(100) // Used original stale snapshot (not 120)
    expect(result.outcome).toBe('DRAW') // Same price => DRAW
    expect(logger.info).toHaveBeenCalledWith(
      'Newer snapshot is after settleAt, using original',
      expect.objectContaining({ settleAt })
    )
  })

  it('marks guess FAILED when no fresh snapshot after max retries (data pipeline issue)', async () => {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const settleAt = new Date(now + 60_000).toISOString()
    // Stale snapshot: 60s before settleAt
    const staleSourceUpdatedAt = new Date(now).toISOString()

    appsync.makeAppSyncRequest
      .mockResolvedValueOnce({
        data: {
          getGuess: {
            id: 'g4',
            owner: 'sub-4',
            createdAt,
            settleAt,
            direction: 'UP',
            status: 'PENDING',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      })
      // resolveEndSnapshot - first fetch (stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 1 (still stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 2 (still stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 3 (still stale)
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // resolveEndSnapshot - retry 4 (still stale) - MAX_RETRIES = 4
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-stale', priceUsd: 100, sourceUpdatedAt: staleSourceUpdatedAt }],
          },
        },
      })
      // markGuessFailed
      .mockResolvedValueOnce({ data: { updateGuess: { id: 'g4', status: 'FAILED' } } })

    const resultPromise = handler({ guessId: 'g4' })
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.reason).toBe('SNAPSHOTS_NOT_FOUND')
    expect(result.status).toBe('FAILED')
    expect(logger.error).toHaveBeenCalledWith(
      'No fresh snapshot after retries, cannot settle reliably',
      expect.objectContaining({ settleAt })
    )
    expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('mutation FailGuess'),
        variables: { input: { id: 'g4', status: 'FAILED' } },
      })
    )
  })
})
