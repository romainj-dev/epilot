import 'server-only'

import { getAppSyncApiKey, getAppSyncEndpoint } from '@/lib/env'
import {
  OnCreatePriceSnapshotDocument,
  type OnCreatePriceSnapshotSubscription,
} from '@/graphql/generated/graphql'
import {
  AppSyncRealtimeClient,
  type SubscriptionHandle,
} from '@/lib/appsync-realtime-client'

/**
 * Price snapshot data type from subscription.
 */
type PriceSnapshot = NonNullable<
  OnCreatePriceSnapshotSubscription['onCreatePriceSnapshot']
>

/**
 * Type guard for price snapshot data validation.
 */
function isPriceSnapshot(value: unknown): value is PriceSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.pk === 'string' &&
    typeof record.capturedAt === 'string' &&
    typeof record.priceUsd === 'number' &&
    // Optional fields (present in subscription selection)
    (record.sourceUpdatedAt == null ||
      typeof record.sourceUpdatedAt === 'string') &&
    (record.source == null || typeof record.source === 'string')
  )
}

/**
 * Global singleton client for price snapshot subscriptions.
 */
const client = new AppSyncRealtimeClient<PriceSnapshot>()

/**
 * Callbacks for price snapshot subscription.
 */
interface PriceSnapshotSubscriptionCallbacks {
  onSnapshot: (snapshot: PriceSnapshot) => void
  onError?: (error: Error) => void
}

/**
 * Ensures a subscription to price snapshot events.
 *
 * Uses a global WebSocket connection shared across all subscribers.
 * Automatically manages connection lifecycle with graceful cleanup.
 *
 * @param callbacks - Snapshot and error callbacks
 * @returns Handle to stop the subscription
 */
export function ensurePriceSnapshotSubscription(
  callbacks: PriceSnapshotSubscriptionCallbacks
): SubscriptionHandle {
  const { onSnapshot, onError } = callbacks

  return client.subscribe(
    {
      endpoint: getAppSyncEndpoint(),
      auth: {
        type: 'API_KEY',
        apiKey: getAppSyncApiKey(),
      },
      subscription: {
        document: OnCreatePriceSnapshotDocument,
        operationName: 'OnCreatePriceSnapshot',
        variables: {
          filter: {
            pk: { eq: 'PriceSnapshot' },
          },
        },
        extractData: (payload) => payload.onCreatePriceSnapshot,
        validateData: isPriceSnapshot,
      },
      logPrefix: '[PriceSnapshot Realtime]',
    },
    {
      onData: onSnapshot,
      onError,
    },
    null // Global subscription (no per-user ownership)
  )
}
