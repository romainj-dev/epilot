import 'server-only'

import type { OnCreatePriceSnapshotSubscription } from '@/graphql/generated/graphql'
import type { PriceSnapshotStream } from '@/types/price-snapshot'

import { ensurePriceSnapshotSubscription } from './appsync-realtime'

export type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshotStream | null }
  | { type: 'error'; payload: { message: string } }

type ClientSendFunction = (message: StreamMessage) => void

interface RelayState {
  clients: Set<ClientSendFunction>
  upstreamHandle: { stop: () => void } | null
}

const relay: RelayState = {
  clients: new Set(),
  upstreamHandle: null,
}

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
 * Broadcast a message to all connected SSE clients.
 */
function broadcast(message: StreamMessage): void {
  console.log(
    `[Relay] Broadcasting to ${relay.clients.size} client(s):`,
    message.type
  )

  relay.clients.forEach((send) => {
    try {
      send(message)
    } catch (error) {
      console.error('[Relay] Failed to send to client:', error)
    }
  })
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
      broadcast({ type: 'snapshot', payload })
    },
    onError: (error) => {
      console.error('[Relay] Upstream error:', error)
      broadcast({
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
export function addClient(send: ClientSendFunction): void {
  relay.clients.add(send)

  console.log(`[Relay] Client added (total: ${relay.clients.size})`)

  // Start upstream if this is the first client
  if (relay.clients.size === 1) {
    startUpstream()
  }
}

/**
 * Unregister an SSE client from the relay.
 * Stops the upstream subscription when the last client disconnects
 * (after a grace period handled by the upstream subscription itself).
 */
export function removeClient(send: ClientSendFunction): void {
  relay.clients.delete(send)

  console.log(`[Relay] Client removed (remaining: ${relay.clients.size})`)

  // Stop upstream if no clients remain
  if (relay.clients.size === 0) {
    stopUpstream()
  }
}

/**
 * Get the current number of connected clients (for debugging/logging).
 */
export function getClientCount(): number {
  return relay.clients.size
}
