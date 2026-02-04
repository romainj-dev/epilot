/**
 * Guess settlement SSE relay
 *
 * Bridges AppSync subscriptions to multiple SSE clients per user.
 * Maintains one WebSocket per user, shared by multiple browser connections.
 * Automatically manages lifecycle: connects on first client, disconnects when idle.
 */

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

export function getClientCount(owner: string): number {
  const relay = relays.get(owner)
  return relay?.clients.size ?? 0
}
