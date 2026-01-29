import 'server-only'

import type { OnUpdateGuessSubscription } from '@/graphql/generated/graphql'
import {
  createRelayState,
  addClient,
  removeClient,
  broadcast,
  type ClientSendFunction,
  type RelayState,
} from '@/lib/sse-relay'
import { ensureGuessSubscription } from './appsync-guess-subscription'

export type GuessStreamMessage =
  | { type: 'settled'; payload: GuessSettledPayload }
  | { type: 'error'; payload: { message: string } }

export type GuessSettledPayload = NonNullable<
  OnUpdateGuessSubscription['onUpdateGuess']
>

// Map of owner -> relay state
const relays = new Map<string, RelayState<GuessStreamMessage>>()

/**
 * Get or create a relay state for a specific user
 */
function getOrCreateRelay(owner: string): RelayState<GuessStreamMessage> {
  let relay = relays.get(owner)
  if (!relay) {
    relay = createRelayState<GuessStreamMessage>()
    relays.set(owner, relay)
  }
  return relay
}

/**
 * Start the upstream AppSync subscription for a specific user
 */
function startUpstream(owner: string, idToken: string): void {
  const relay = getOrCreateRelay(owner)

  if (relay.upstreamHandle) {
    console.log(
      `[Guess Relay] Upstream subscription already active for ${owner}`
    )
    return
  }

  console.log(
    `[Guess Relay] Starting upstream AppSync subscription for ${owner}`
  )

  relay.upstreamHandle = ensureGuessSubscription(owner, idToken, {
    onGuessUpdate: (guess) => {
      // Broadcast settled guesses (already filtered in subscription)
      broadcast(
        relay,
        { type: 'settled', payload: guess },
        `[Guess Relay:${owner}]`
      )
    },
    onError: (error) => {
      console.error(`[Guess Relay] Upstream error for ${owner}:`, error)
      broadcast(
        relay,
        {
          type: 'error',
          payload: { message: error.message },
        },
        `[Guess Relay:${owner}]`
      )
    },
  })

  console.log(`[Guess Relay] Upstream subscription started for ${owner}`)
}

/**
 * Stop the upstream AppSync subscription for a specific user
 */
function stopUpstream(owner: string): void {
  const relay = relays.get(owner)
  if (!relay || !relay.upstreamHandle) {
    return
  }

  console.log(`[Guess Relay] Stopping upstream subscription for ${owner}`)
  relay.upstreamHandle.stop()
  relay.upstreamHandle = null

  // Clean up relay if no clients
  if (relay.clients.size === 0) {
    relays.delete(owner)
  }
}

/**
 * Register a new SSE client with the relay for a specific user
 */
export function addGuessClient(
  owner: string,
  idToken: string,
  send: ClientSendFunction<GuessStreamMessage>
): void {
  const relay = getOrCreateRelay(owner)

  addClient(
    relay,
    send,
    () => startUpstream(owner, idToken),
    `[Guess Relay:${owner}]`
  )
}

/**
 * Unregister an SSE client from the relay for a specific user
 */
export function removeGuessClient(
  owner: string,
  send: ClientSendFunction<GuessStreamMessage>
): void {
  const relay = relays.get(owner)
  if (!relay) {
    return
  }

  removeClient(relay, send, () => stopUpstream(owner), `[Guess Relay:${owner}]`)

  // Clean up relay map if empty
  if (relay.clients.size === 0 && !relay.upstreamHandle) {
    relays.delete(owner)
  }
}

/**
 * Get the current number of connected clients for a user (for debugging/logging)
 */
export function getClientCount(owner: string): number {
  const relay = relays.get(owner)
  return relay?.clients.size ?? 0
}
