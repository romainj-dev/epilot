/**
 * Price snapshot SSE relay
 *
 * Bridges AppSync subscription to multiple SSE clients (global broadcast).
 * Maintains a single WebSocket shared by all connected users.
 * Automatically manages lifecycle: connects on first client, disconnects when idle.
 */

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
import { ensurePriceSnapshotSubscription } from './appsync-price-snapshot-subscription'

export type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshotStream | null }
  | { type: 'error'; payload: { message: string } }

const relay: RelayState<StreamMessage> = createRelayState<StreamMessage>()

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

function stopUpstream(): void {
  if (!relay.upstreamHandle) {
    return
  }

  console.log('[Relay] Stopping upstream subscription')
  relay.upstreamHandle.stop()
  relay.upstreamHandle = null
}

export function addClient(send: ClientSendFunction<StreamMessage>): void {
  addClientGeneric(relay, send, startUpstream)
}

export function removeClient(send: ClientSendFunction<StreamMessage>): void {
  removeClientGeneric(relay, send, stopUpstream)
}

export function getClientCount(): number {
  return relay.clients.size
}
