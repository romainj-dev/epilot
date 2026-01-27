/**
 * Unit tests for price snapshot relay
 *
 * Mocks the upstream AppSync subscription (appsync-realtime)
 */

// Mock appsync-realtime before importing relay
jest.mock('./appsync-realtime', () => ({
  ensurePriceSnapshotSubscription: jest.fn(),
}))

import { addClient, removeClient, getClientCount } from './price-snapshot-relay'
import { ensurePriceSnapshotSubscription } from './appsync-realtime'

const mockEnsurePriceSnapshotSubscription =
  ensurePriceSnapshotSubscription as jest.MockedFunction<
    typeof ensurePriceSnapshotSubscription
  >

describe('Price Snapshot Relay', () => {
  let mockStop: jest.Mock
  let connectedClients: Array<jest.Mock> = []

  const connectClient = (client: jest.Mock) => {
    connectedClients.push(client)
    addClient(client)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockStop = jest.fn()
    connectedClients = []
    mockEnsurePriceSnapshotSubscription.mockReturnValue({
      stop: mockStop,
    })
  })

  afterEach(() => {
    // Clean up after each test (remove by reference; removeClient matches by function identity)
    connectedClients.forEach((client) => removeClient(client))
    connectedClients = []
  })

  it('should start upstream subscription when first client connects', () => {
    const client1 = jest.fn()

    expect(getClientCount()).toBe(0)
    expect(mockEnsurePriceSnapshotSubscription).not.toHaveBeenCalled()

    connectClient(client1)

    expect(getClientCount()).toBe(1)
    expect(mockEnsurePriceSnapshotSubscription).toHaveBeenCalledTimes(1)
    expect(mockEnsurePriceSnapshotSubscription).toHaveBeenCalledWith({
      onSnapshot: expect.any(Function),
      onError: expect.any(Function),
    })
  })

  it('should not restart upstream when second client connects', () => {
    const client1 = jest.fn()
    const client2 = jest.fn()

    connectClient(client1)
    expect(mockEnsurePriceSnapshotSubscription).toHaveBeenCalledTimes(1)

    connectClient(client2)
    expect(getClientCount()).toBe(2)
    // Still only called once
    expect(mockEnsurePriceSnapshotSubscription).toHaveBeenCalledTimes(1)
  })

  it('should broadcast snapshot to all connected clients', () => {
    const client1 = jest.fn()
    const client2 = jest.fn()
    const client3 = jest.fn()

    connectClient(client1)
    connectClient(client2)
    connectClient(client3)

    // Get the onSnapshot callback that was passed to ensurePriceSnapshotSubscription
    const { onSnapshot } = mockEnsurePriceSnapshotSubscription.mock.calls[0][0]

    const mockSnapshot = {
      __typename: 'PriceSnapshot' as const,
      id: 'snap-123',
      pk: 'PriceSnapshot',
      capturedAt: '2026-01-27T12:00:00Z',
      priceUsd: 50000.0,
      sourceUpdatedAt: '2026-01-27T12:00:00Z',
      source: 'test',
    }

    onSnapshot(mockSnapshot)

    // All clients should receive the snapshot
    expect(client1).toHaveBeenCalledTimes(1)
    expect(client1).toHaveBeenCalledWith({
      type: 'snapshot',
      payload: {
        __typename: 'PriceSnapshot',
        id: 'snap-123',
        pk: 'PriceSnapshot',
        capturedAt: '2026-01-27T12:00:00Z',
        priceUsd: 50000.0,
      },
    })

    expect(client2).toHaveBeenCalledWith({
      type: 'snapshot',
      payload: expect.objectContaining({ id: 'snap-123' }),
    })

    expect(client3).toHaveBeenCalledWith({
      type: 'snapshot',
      payload: expect.objectContaining({ id: 'snap-123' }),
    })
  })

  it('should broadcast error to all connected clients', () => {
    const client1 = jest.fn()
    const client2 = jest.fn()

    connectClient(client1)
    connectClient(client2)

    const { onError } = mockEnsurePriceSnapshotSubscription.mock.calls[0][0]

    const error = new Error('Subscription failed')
    onError!(error)

    expect(client1).toHaveBeenCalledWith({
      type: 'error',
      payload: { message: 'Subscription failed' },
    })

    expect(client2).toHaveBeenCalledWith({
      type: 'error',
      payload: { message: 'Subscription failed' },
    })
  })

  it('should handle client send errors gracefully without crashing', () => {
    const client1 = jest.fn()
    const client2 = jest.fn().mockImplementation(() => {
      throw new Error('Client disconnected')
    })
    const client3 = jest.fn()

    connectClient(client1)
    connectClient(client2)
    connectClient(client3)

    const { onSnapshot } = mockEnsurePriceSnapshotSubscription.mock.calls[0][0]

    const mockSnapshot = {
      __typename: 'PriceSnapshot' as const,
      id: 'snap-123',
      pk: 'PriceSnapshot',
      capturedAt: '2026-01-27T12:00:00Z',
      priceUsd: 50000.0,
      sourceUpdatedAt: '2026-01-27T12:00:00Z',
      source: 'test',
    }

    // Should not throw even though client2 throws
    expect(() => onSnapshot(mockSnapshot)).not.toThrow()

    // Other clients should still receive the message
    expect(client1).toHaveBeenCalled()
    expect(client3).toHaveBeenCalled()
  })

  it('should not stop upstream when one client disconnects but others remain', () => {
    const client1 = jest.fn()
    const client2 = jest.fn()

    connectClient(client1)
    connectClient(client2)

    removeClient(client1)

    expect(getClientCount()).toBe(1)
    expect(mockStop).not.toHaveBeenCalled()
  })

  it('should stop upstream when last client disconnects', () => {
    const client1 = jest.fn()
    const client2 = jest.fn()

    connectClient(client1)
    connectClient(client2)

    removeClient(client1)
    expect(mockStop).not.toHaveBeenCalled()

    removeClient(client2)
    expect(getClientCount()).toBe(0)
    expect(mockStop).toHaveBeenCalledTimes(1)
  })

  it('should handle removing the same client multiple times gracefully', () => {
    const client1 = jest.fn()

    connectClient(client1)
    expect(getClientCount()).toBe(1)

    removeClient(client1)
    expect(getClientCount()).toBe(0)
    expect(mockStop).toHaveBeenCalledTimes(1)

    // Removing again should be a no-op (Set.delete is idempotent)
    removeClient(client1)
    expect(getClientCount()).toBe(0)
    // stop should not be called again
    expect(mockStop).toHaveBeenCalledTimes(1)
  })
})
