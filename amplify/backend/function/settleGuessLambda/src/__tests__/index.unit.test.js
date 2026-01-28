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

describe('settleGuessLambda handler', () => {
  const MOCK_ENDPOINT = 'https://mock-appsync.amazonaws.com/graphql'
  const MOCK_API_KEY = 'da2-mockApiKey123'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.APPSYNC_ENDPOINT_SSM_PATH = '/epilot/dev/appsync-endpoint'
    process.env.APPSYNC_API_KEY_SSM_PATH = '/epilot/dev/appsync-api-key'

    ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
      if (path.includes('endpoint')) return MOCK_ENDPOINT
      if (path.includes('api-key')) return MOCK_API_KEY
      return null
    })
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

    appsync.makeAppSyncRequest
      // fetchGuess
      .mockResolvedValueOnce({
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
      })
      // resolveSnapshot(start) -> price 100
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-start', priceUsd: 100, sourceUpdatedAt: createdAt }],
          },
        },
      })
      // resolveSnapshot(end) -> price 110 => UP => WIN => +1
      .mockResolvedValueOnce({
        data: {
          priceSnapshotsBySourceUpdatedAt: {
            items: [{ id: 's-end', priceUsd: 110, sourceUpdatedAt: settleAt }],
          },
        },
      })
      // settleGuess(updateGuess)
      .mockResolvedValueOnce({
        data: {
          updateGuess: { id: 'g2', status: 'SETTLED' },
        },
      })
      // getUserState
      .mockResolvedValueOnce({
        data: {
          getUserState: { id: 'sub-2', score: 5 },
        },
      })
      // updateUserState
      .mockResolvedValueOnce({
        data: {
          updateUserState: { id: 'sub-2', score: 6 },
        },
      })

    await handler({ guessId: 'g2' })

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

