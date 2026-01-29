/**
 * Unit tests for guess relay
 *
 * Mocks the upstream AppSync subscription (appsync-guess-subscription)
 */

// Mock appsync-guess-subscription before importing relay
jest.mock('./appsync-guess-subscription', () => ({
  ensureGuessSubscription: jest.fn(),
}))

import {
  addGuessClient,
  removeGuessClient,
  getClientCount,
} from './guess-relay'
import { ensureGuessSubscription } from './appsync-guess-subscription'
import {
  GuessStatus,
  GuessDirection,
  GuessResultDirection,
  GuessOutcome,
} from '@/graphql/generated/graphql'

const mockEnsureGuessSubscription =
  ensureGuessSubscription as jest.MockedFunction<typeof ensureGuessSubscription>

describe('Guess Relay', () => {
  let mockStop: jest.Mock
  const testOwner = 'user-123'
  const testIdToken = 'mock-id-token-abc'
  const testOwner2 = 'user-456'
  const testIdToken2 = 'mock-id-token-def'

  // Track connected clients by owner
  const connectedClientsByOwner = new Map<string, Array<jest.Mock>>()

  const connectClient = (owner: string, idToken: string, client: jest.Mock) => {
    if (!connectedClientsByOwner.has(owner)) {
      connectedClientsByOwner.set(owner, [])
    }
    connectedClientsByOwner.get(owner)!.push(client)
    addGuessClient(owner, idToken, client)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockStop = jest.fn()
    connectedClientsByOwner.clear()
    mockEnsureGuessSubscription.mockReturnValue({
      stop: mockStop,
    })
  })

  afterEach(() => {
    // Clean up after each test
    connectedClientsByOwner.forEach((clients, owner) => {
      clients.forEach((client) => removeGuessClient(owner, client))
    })
    connectedClientsByOwner.clear()
  })

  describe('single user relay', () => {
    it('should start upstream subscription when first client connects', () => {
      const client1 = jest.fn()

      expect(getClientCount(testOwner)).toBe(0)
      expect(mockEnsureGuessSubscription).not.toHaveBeenCalled()

      connectClient(testOwner, testIdToken, client1)

      expect(getClientCount(testOwner)).toBe(1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledWith(
        testOwner,
        testIdToken,
        {
          onGuessUpdate: expect.any(Function),
          onError: expect.any(Function),
        }
      )
    })

    it('should not restart upstream when second client connects for same user', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(1)

      connectClient(testOwner, testIdToken, client2)
      expect(getClientCount(testOwner)).toBe(2)
      // Still only called once for this owner
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(1)
    })

    it('should broadcast settled guess to all connected clients for that user', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()
      const client3 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      connectClient(testOwner, testIdToken, client2)
      connectClient(testOwner, testIdToken, client3)

      // Get the onGuessUpdate callback that was passed to ensureGuessSubscription
      // ensureGuessSubscription(owner, idToken, callbacks) - callbacks are at index 2
      const { onGuessUpdate } = mockEnsureGuessSubscription.mock.calls[0][2]

      const mockGuess = {
        __typename: 'Guess' as const,
        id: 'guess-123',
        owner: testOwner,
        createdAt: '2026-01-27T12:00:00Z',
        settleAt: '2026-01-27T12:01:00Z',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        result: GuessResultDirection.Up,
        outcome: GuessOutcome.Win,
        startPriceSnapshotId: 'snap-start',
        endPriceSnapshotId: 'snap-end',
        startPrice: 98500.0,
        endPrice: 99100.0,
        updatedAt: '2026-01-27T12:01:00Z',
      }

      onGuessUpdate(mockGuess)

      // All clients for this owner should receive the settled guess
      expect(client1).toHaveBeenCalledTimes(1)
      expect(client1).toHaveBeenCalledWith({
        type: 'settled',
        payload: mockGuess,
      })

      expect(client2).toHaveBeenCalledWith({
        type: 'settled',
        payload: expect.objectContaining({
          id: 'guess-123',
          outcome: 'WIN',
        }),
      })

      expect(client3).toHaveBeenCalledWith({
        type: 'settled',
        payload: expect.objectContaining({
          id: 'guess-123',
          status: 'SETTLED',
        }),
      })
    })

    it('should broadcast error to all connected clients for that user', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      connectClient(testOwner, testIdToken, client2)

      const { onError } = mockEnsureGuessSubscription.mock.calls[0][2]

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

      connectClient(testOwner, testIdToken, client1)
      connectClient(testOwner, testIdToken, client2)
      connectClient(testOwner, testIdToken, client3)

      const { onGuessUpdate } = mockEnsureGuessSubscription.mock.calls[0][2]

      const mockGuess = {
        __typename: 'Guess' as const,
        id: 'guess-123',
        owner: testOwner,
        createdAt: '2026-01-27T12:00:00Z',
        settleAt: '2026-01-27T12:01:00Z',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        result: GuessResultDirection.Up,
        outcome: GuessOutcome.Win,
        startPriceSnapshotId: null,
        endPriceSnapshotId: null,
        startPrice: null,
        endPrice: null,
        updatedAt: '2026-01-27T12:01:00Z',
      }

      // Should not throw even though client2 throws
      expect(() => onGuessUpdate(mockGuess)).not.toThrow()

      // Other clients should still receive the message
      expect(client1).toHaveBeenCalled()
      expect(client3).toHaveBeenCalled()
    })

    it('should not stop upstream when one client disconnects but others remain', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      connectClient(testOwner, testIdToken, client2)

      removeGuessClient(testOwner, client1)

      expect(getClientCount(testOwner)).toBe(1)
      expect(mockStop).not.toHaveBeenCalled()
    })

    it('should stop upstream when last client disconnects for that user', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      connectClient(testOwner, testIdToken, client2)

      removeGuessClient(testOwner, client1)
      expect(mockStop).not.toHaveBeenCalled()

      removeGuessClient(testOwner, client2)
      expect(getClientCount(testOwner)).toBe(0)
      expect(mockStop).toHaveBeenCalledTimes(1)
    })

    it('should handle removing the same client multiple times gracefully', () => {
      const client1 = jest.fn()

      connectClient(testOwner, testIdToken, client1)
      expect(getClientCount(testOwner)).toBe(1)

      removeGuessClient(testOwner, client1)
      expect(getClientCount(testOwner)).toBe(0)
      expect(mockStop).toHaveBeenCalledTimes(1)

      // Removing again should be a no-op (Set.delete is idempotent)
      removeGuessClient(testOwner, client1)
      expect(getClientCount(testOwner)).toBe(0)
      // stop should not be called again
      expect(mockStop).toHaveBeenCalledTimes(1)
    })
  })

  describe('multi-user relay isolation', () => {
    it('should maintain separate upstream subscriptions per user', () => {
      const user1Client1 = jest.fn()
      const user2Client1 = jest.fn()

      // Connect first user
      connectClient(testOwner, testIdToken, user1Client1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledWith(
        testOwner,
        testIdToken,
        expect.any(Object)
      )

      // Connect second user - should create a new subscription
      connectClient(testOwner2, testIdToken2, user2Client1)
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(2)
      expect(mockEnsureGuessSubscription).toHaveBeenNthCalledWith(
        2,
        testOwner2,
        testIdToken2,
        expect.any(Object)
      )

      expect(getClientCount(testOwner)).toBe(1)
      expect(getClientCount(testOwner2)).toBe(1)
    })

    it('should only broadcast to clients of the correct user', () => {
      const user1Client1 = jest.fn()
      const user1Client2 = jest.fn()
      const user2Client1 = jest.fn()
      const user2Client2 = jest.fn()

      connectClient(testOwner, testIdToken, user1Client1)
      connectClient(testOwner, testIdToken, user1Client2)
      connectClient(testOwner2, testIdToken2, user2Client1)
      connectClient(testOwner2, testIdToken2, user2Client2)

      // Capture callbacks before clearing mocks
      const user1Callback = mockEnsureGuessSubscription.mock.calls[0][2]
      const user2Callback = mockEnsureGuessSubscription.mock.calls[1][2]

      // Trigger update for user1
      const mockGuessUser1 = {
        __typename: 'Guess' as const,
        id: 'guess-user1',
        owner: testOwner,
        createdAt: '2026-01-27T12:00:00Z',
        settleAt: '2026-01-27T12:01:00Z',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        result: GuessResultDirection.Up,
        outcome: GuessOutcome.Win,
        startPriceSnapshotId: null,
        endPriceSnapshotId: null,
        startPrice: null,
        endPrice: null,
        updatedAt: '2026-01-27T12:01:00Z',
      }

      user1Callback.onGuessUpdate(mockGuessUser1)

      // Only user1's clients should receive the update
      expect(user1Client1).toHaveBeenCalledWith({
        type: 'settled',
        payload: mockGuessUser1,
      })
      expect(user1Client2).toHaveBeenCalledWith({
        type: 'settled',
        payload: mockGuessUser1,
      })

      // User2's clients should NOT receive user1's update
      expect(user2Client1).not.toHaveBeenCalled()
      expect(user2Client2).not.toHaveBeenCalled()

      // Clear client mocks (but keep callbacks) and test the reverse
      user1Client1.mockClear()
      user1Client2.mockClear()
      user2Client1.mockClear()
      user2Client2.mockClear()

      // Trigger update for user2
      const mockGuessUser2 = {
        __typename: 'Guess' as const,
        id: 'guess-user2',
        owner: testOwner2,
        createdAt: '2026-01-27T12:00:00Z',
        settleAt: '2026-01-27T12:01:00Z',
        direction: GuessDirection.Down,
        status: GuessStatus.Settled,
        result: GuessResultDirection.Down,
        outcome: GuessOutcome.Win,
        startPriceSnapshotId: null,
        endPriceSnapshotId: null,
        startPrice: null,
        endPrice: null,
        updatedAt: '2026-01-27T12:01:00Z',
      }

      user2Callback.onGuessUpdate(mockGuessUser2)

      // Only user2's clients should receive the update
      expect(user2Client1).toHaveBeenCalledWith({
        type: 'settled',
        payload: mockGuessUser2,
      })
      expect(user2Client2).toHaveBeenCalledWith({
        type: 'settled',
        payload: mockGuessUser2,
      })

      // User1's clients should NOT receive user2's update
      expect(user1Client1).not.toHaveBeenCalled()
      expect(user1Client2).not.toHaveBeenCalled()
    })

    it('should independently manage upstream lifecycle for each user', () => {
      const user1Client1 = jest.fn()
      const user1Client2 = jest.fn()
      const user2Client1 = jest.fn()

      const mockStopUser1 = jest.fn()
      const mockStopUser2 = jest.fn()

      // Setup different stop functions for each user
      mockEnsureGuessSubscription
        .mockReturnValueOnce({ stop: mockStopUser1 })
        .mockReturnValueOnce({ stop: mockStopUser2 })

      // Connect clients for both users
      connectClient(testOwner, testIdToken, user1Client1)
      connectClient(testOwner, testIdToken, user1Client2)
      connectClient(testOwner2, testIdToken2, user2Client1)

      expect(getClientCount(testOwner)).toBe(2)
      expect(getClientCount(testOwner2)).toBe(1)

      // Disconnect all user1 clients
      removeGuessClient(testOwner, user1Client1)
      removeGuessClient(testOwner, user1Client2)

      // Only user1's upstream should stop
      expect(mockStopUser1).toHaveBeenCalledTimes(1)
      expect(mockStopUser2).not.toHaveBeenCalled()
      expect(getClientCount(testOwner)).toBe(0)
      expect(getClientCount(testOwner2)).toBe(1)

      // Disconnect user2 client
      removeGuessClient(testOwner2, user2Client1)

      // Now user2's upstream should stop
      expect(mockStopUser2).toHaveBeenCalledTimes(1)
      expect(getClientCount(testOwner2)).toBe(0)
    })

    it('should handle errors independently per user', () => {
      const user1Client = jest.fn()
      const user2Client = jest.fn()

      connectClient(testOwner, testIdToken, user1Client)
      connectClient(testOwner2, testIdToken2, user2Client)

      // Trigger error for user1 only
      const user1Callback = mockEnsureGuessSubscription.mock.calls[0][2]
      const error = new Error('User1 subscription failed')
      user1Callback.onError!(error)

      // Only user1's client should receive the error
      expect(user1Client).toHaveBeenCalledWith({
        type: 'error',
        payload: { message: 'User1 subscription failed' },
      })

      // User2's client should not receive user1's error
      expect(user2Client).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle zero clients gracefully', () => {
      expect(getClientCount(testOwner)).toBe(0)
      expect(getClientCount('non-existent-owner')).toBe(0)

      // Removing from empty relay should not crash
      const client = jest.fn()
      expect(() => removeGuessClient(testOwner, client)).not.toThrow()
    })

    it('should handle rapid connect/disconnect cycles', () => {
      const client1 = jest.fn()
      const client2 = jest.fn()

      // Rapid connect/disconnect
      connectClient(testOwner, testIdToken, client1)
      removeGuessClient(testOwner, client1)
      connectClient(testOwner, testIdToken, client2)

      // Should have started subscription twice (once per connect)
      // Note: In production, the upstream subscription has its own
      // grace period that might prevent actual reconnection
      expect(mockEnsureGuessSubscription).toHaveBeenCalledTimes(2)
      expect(getClientCount(testOwner)).toBe(1)
    })

    it('should handle receiving updates when no clients are connected', () => {
      const client = jest.fn()

      connectClient(testOwner, testIdToken, client)

      const { onGuessUpdate } = mockEnsureGuessSubscription.mock.calls[0][2]

      // Disconnect client
      removeGuessClient(testOwner, client)

      // Update arrives after disconnect (edge case in timing)
      const mockGuess = {
        __typename: 'Guess' as const,
        id: 'guess-late',
        owner: testOwner,
        createdAt: '2026-01-27T12:00:00Z',
        settleAt: '2026-01-27T12:01:00Z',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        result: GuessResultDirection.Up,
        outcome: GuessOutcome.Win,
        startPriceSnapshotId: null,
        endPriceSnapshotId: null,
        startPrice: null,
        endPrice: null,
        updatedAt: '2026-01-27T12:01:00Z',
      }

      // Should not crash
      expect(() => onGuessUpdate(mockGuess)).not.toThrow()

      // Client should not receive update (already disconnected)
      expect(client).toHaveBeenCalledTimes(0)
    })
  })
})
