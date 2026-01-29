import 'server-only'

import type { OnCreatePriceSnapshotSubscription } from '@/graphql/generated/graphql'
import type { PriceSnapshotStream } from '@/types/price-snapshot'
import {
  createRelayState,
  addClient as addClientGeneric,
  removeClient as removeClientGeneric,
  broadcast,
  type RelayState,
  type ClientSendFunction,
} from '@/lib/sse-relay'
import { ensurePriceSnapshotSubscription } from './appsync-realtime'

export type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshotStream | null }
  | { type: 'error'; payload: { message: string } }

const relay: RelayState<StreamMessage> = createRelayState<StreamMessage>()

/**
 * Convert an AppSync subscription snapshot to a stream message payload.
 */
function toStreamPayload(
  snapshot: NonNullable<
    OnCreatePriceSnapshotSubscription['onCreatePriceSnapshot']
  >
): PriceSnapshotStream {
  return {
    __typename: 'PriceSnapshot',
    id: snapshot.id,
    pk: snapshot.pk,
    capturedAt: snapshot.capturedAt,
    priceUsd: snapshot.priceUsd,
  }
}

/**
 * Start the upstream AppSync subscription if not already running.
 */
function startUpstream(): void {
  if (relay.upstreamHandle) {
    console.log('[Relay] Upstream subscription already active')
    return
  }

  console.log('[Relay] Starting upstream AppSync subscription')

  relay.upstreamHandle = ensurePriceSnapshotSubscription({
    onSnapshot: (snapshot) => {
      const payload = toStreamPayload(snapshot)
      broadcast(relay, { type: 'snapshot', payload })
    },
    onError: (error) => {
      console.error('[Relay] Upstream error:', error)
      broadcast(relay, {
        type: 'error',
        payload: { message: error.message },
      })
    },
  })

  console.log('[Relay] Upstream subscription started')
}

/**
 * Stop the upstream AppSync subscription.
 */
function stopUpstream(): void {
  if (!relay.upstreamHandle) {
    return
  }

  console.log('[Relay] Stopping upstream subscription')
  relay.upstreamHandle.stop()
  relay.upstreamHandle = null
}

/**
 * Register a new SSE client with the relay.
 * Starts the upstream subscription on the first client.
 */
export function addClient(send: ClientSendFunction<StreamMessage>): void {
  addClientGeneric(relay, send, startUpstream)
}

/**
 * Unregister an SSE client from the relay.
 * Stops the upstream subscription when the last client disconnects
 * (after a grace period handled by the upstream subscription itself).
 */
export function removeClient(send: ClientSendFunction<StreamMessage>): void {
  removeClientGeneric(relay, send, stopUpstream)
}

/**
 * Get the current number of connected clients (for debugging/logging).
 */
export function getClientCount(): number {
  return relay.clients.size
}
