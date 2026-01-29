import 'server-only'

import { getAppSyncEndpoint } from '@/lib/env'
import {
  OnUpdateGuessDocument,
  type OnUpdateGuessSubscription,
  GuessStatus,
} from '@/graphql/generated/graphql'
import {
  AppSyncRealtimeClient,
  type SubscriptionHandle,
} from '@/lib/appsync-realtime-client'

/**
 * Guess update data type from subscription.
 */
type GuessUpdate = NonNullable<OnUpdateGuessSubscription['onUpdateGuess']>

/**
 * Type guard for guess update data validation.
 */
function isGuessUpdate(value: unknown): value is GuessUpdate {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.owner === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.settleAt === 'string' &&
    typeof record.direction === 'string' &&
    typeof record.status === 'string'
  )
}

/**
 * Global singleton client for guess update subscriptions.
 * Manages per-user WebSocket connections.
 */
const client = new AppSyncRealtimeClient<GuessUpdate>()

/**
 * Callbacks for guess update subscription.
 */
interface GuessSubscriptionCallbacks {
  onGuessUpdate: (guess: GuessUpdate) => void
  onError?: (error: Error) => void
}

/**
 * Ensures a subscription to guess update events for a specific user.
 *
 * Creates a dedicated WebSocket connection per user (owner) to receive
 * real-time updates when their guesses are settled. Automatically manages
 * connection lifecycle with graceful cleanup.
 *
 * @param owner - User ID (Cognito sub) that owns the guesses
 * @param idToken - Cognito ID token for authentication
 * @param callbacks - Guess update and error callbacks
 * @returns Handle to stop the subscription
 */
export function ensureGuessSubscription(
  owner: string,
  idToken: string,
  callbacks: GuessSubscriptionCallbacks
): SubscriptionHandle {
  const { onGuessUpdate, onError } = callbacks

  return client.subscribe(
    {
      endpoint: getAppSyncEndpoint(),
      auth: {
        type: 'COGNITO_USER_POOLS',
        idToken,
      },
      subscription: {
        document: OnUpdateGuessDocument,
        operationName: 'OnUpdateGuess',
        variables: {
          owner,
        },
        extractData: (payload) => payload.onUpdateGuess,
        validateData: isGuessUpdate,
        // Only broadcast settled guesses (server-side filtering)
        filterData: (guess) => guess.status === GuessStatus.Settled,
      },
      logPrefix: '[Guess Realtime]',
    },
    {
      onData: onGuessUpdate,
      onError,
    },
    owner // Per-user subscription
  )
}
