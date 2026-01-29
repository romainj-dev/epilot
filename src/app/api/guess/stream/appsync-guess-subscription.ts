import 'server-only'

import { print } from 'graphql'
import { WebSocket, type RawData } from 'ws'

import { getAppSyncEndpoint } from '@/lib/env'
import {
  OnUpdateGuessDocument,
  type OnUpdateGuessSubscription,
  GuessStatus,
} from '@/graphql/generated/graphql'

// Base64 may contain characters that are not safe in query params (+, /, =),
// so we URL-encode the base64 strings.
function encodeBase64(data: unknown): string {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(data)).toString('base64')
  )
}

/**
 * Convert AppSync HTTP endpoint to realtime WebSocket endpoint with auth headers.
 */
function getAppSyncRealtimeUrl(httpEndpoint: string, idToken: string): string {
  const url = new URL(httpEndpoint)
  const host = url.hostname.replace('appsync-api', 'appsync-realtime-api')
  const header = {
    host: url.hostname,
    Authorization: idToken,
  }
  const encodedHeader = encodeBase64(header)
  const encodedPayload = encodeBase64({})
  return `wss://${host}${url.pathname}?header=${encodedHeader}&payload=${encodedPayload}`
}

function rawDataToString(data: RawData): string {
  if (typeof data === 'string') {
    return data
  }
  if (Buffer.isBuffer(data)) {
    return data.toString()
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString()
  }
  // ArrayBuffer
  return Buffer.from(data).toString()
}

type GuessUpdate = NonNullable<OnUpdateGuessSubscription['onUpdateGuess']>

type GuessUpdateCallback = (guess: GuessUpdate) => void

interface SubscriptionCallbacks {
  onGuessUpdate: GuessUpdateCallback
  onError?: (error: Error) => void
}

interface SubscriptionHandle {
  stop: () => void
}

interface SubscriptionState {
  ws: WebSocket | null
  subscriptionId: string | null
  reconnectTimer: NodeJS.Timeout | null
  subscribers: Set<GuessUpdateCallback>
  idToken: string
  owner: string
}

// Map of owner -> subscription state
const subscriptionStates = new Map<string, SubscriptionState>()

/**
 * Connect to AppSync realtime WebSocket for a specific user.
 */
function connect(
  owner: string,
  idToken: string,
  onError?: (error: Error) => void
): void {
  const state = subscriptionStates.get(owner)
  if (!state) {
    console.error('[Guess Realtime] No state found for owner:', owner)
    return
  }

  if (state.ws) {
    return
  }

  const endpoint = getAppSyncEndpoint()
  const url = getAppSyncRealtimeUrl(endpoint, idToken)
  console.log('[Guess Realtime] Connecting to WebSocket', {
    owner,
    httpHost: new URL(endpoint).hostname,
    realtimeHost: new URL(url).hostname,
  })

  state.ws = new WebSocket(url, 'graphql-ws')

  state.ws.on('open', () => {
    console.log('[Guess Realtime] WebSocket connected for owner:', owner)
    // Send connection init message
    state.ws?.send(JSON.stringify({ type: 'connection_init' }))
  })

  state.ws.on('message', (data: RawData) => {
    try {
      const message = JSON.parse(rawDataToString(data))
      handleMessage(owner, message, onError)
    } catch (error) {
      console.error('[Guess Realtime] Failed to parse message:', error)
    }
  })

  state.ws.on('error', (error) => {
    console.error('[Guess Realtime] WebSocket error:', error)
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  })

  state.ws.on('close', () => {
    console.log('[Guess Realtime] WebSocket closed for owner:', owner)
    state.ws = null
    state.subscriptionId = null

    // Attempt to reconnect if there are active subscribers
    if (state.subscribers.size > 0 && !state.reconnectTimer) {
      console.log('[Guess Realtime] Scheduling reconnect in 5s')
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null
        if (state.subscribers.size > 0) {
          connect(owner, idToken, onError)
        }
      }, 5000)
    }
  })
}

type AppSyncMessageType =
  | 'connection_ack'
  | 'start_ack'
  | 'data'
  | 'error'
  | 'ka'
  | 'complete'

type AppSyncMessage =
  | { type: 'connection_ack' }
  | { type: 'start_ack'; id?: string }
  | { type: 'ka' }
  | { type: 'complete'; id?: string }
  | { type: 'error'; payload?: unknown }
  | {
      type: 'data'
      payload?: { data?: { onUpdateGuess?: unknown }; errors?: unknown }
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAppSyncMessageType(value: unknown): value is AppSyncMessageType {
  return (
    value === 'connection_ack' ||
    value === 'start_ack' ||
    value === 'data' ||
    value === 'error' ||
    value === 'ka' ||
    value === 'complete'
  )
}

function isAppSyncMessage(value: unknown): value is AppSyncMessage {
  if (!isRecord(value)) {
    return false
  }
  return isAppSyncMessageType(value.type)
}

function isGuessUpdate(value: unknown): value is GuessUpdate {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.id === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.settleAt === 'string' &&
    typeof value.direction === 'string' &&
    typeof value.status === 'string'
  )
}

/**
 * Handle incoming AppSync realtime messages.
 */
function handleMessage(
  owner: string,
  message: unknown,
  onError?: (error: Error) => void
): void {
  const state = subscriptionStates.get(owner)
  if (!state) {
    return
  }

  if (!isAppSyncMessage(message)) {
    console.log('[Guess Realtime] Unknown message:', message)
    return
  }

  switch (message.type) {
    case 'connection_ack':
      console.log('[Guess Realtime] Connection acknowledged')
      // Now subscribe to guess updates
      subscribe(owner)
      break

    case 'start_ack':
      console.log('[Guess Realtime] Subscription started:', message.id)
      break

    case 'data':
      {
        if (message.payload?.errors) {
          console.error(
            '[Guess Realtime] Subscription GraphQL errors:',
            message.payload.errors
          )
        }
        const guessUnknown = message.payload?.data?.onUpdateGuess
        if (!isGuessUpdate(guessUnknown)) {
          break
        }
        const guess = guessUnknown
        console.log(
          '[Guess Realtime] Received guess update:',
          guess.id,
          guess.status
        )

        // Only broadcast settled guesses (filter server-side in relay)
        if (guess.status === GuessStatus.Settled) {
          // Broadcast to all subscribers for this owner
          state.subscribers.forEach((cb) => {
            try {
              cb(guess)
            } catch (err) {
              console.error('[Guess Realtime] Subscriber error:', err)
            }
          })
        }
      }
      break

    case 'error':
      console.error('[Guess Realtime] Subscription error:', message)
      if (onError) {
        onError(new Error(JSON.stringify(message.payload ?? message)))
      }
      break

    case 'ka':
      // Keep-alive message, ignore
      break

    case 'complete':
      console.log('[Guess Realtime] Subscription complete')
      state.subscriptionId = null
      break

    default:
      // Exhaustive check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = message
  }
}

/**
 * Send subscription message to AppSync for a specific user.
 */
function subscribe(owner: string): void {
  const state = subscriptionStates.get(owner)
  if (!state) {
    return
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    console.error(
      '[Guess Realtime] Cannot subscribe, WebSocket not ready for owner:',
      owner
    )
    return
  }

  if (state.subscriptionId) {
    console.log('[Guess Realtime] Already subscribed for owner:', owner)
    return
  }

  state.subscriptionId = `guess-subscription-${Date.now()}`

  const subscriptionMessage = {
    id: state.subscriptionId,
    type: 'start',
    payload: {
      data: JSON.stringify({
        operationName: 'OnUpdateGuess',
        query: print(OnUpdateGuessDocument),
        variables: {
          owner: state.owner,
        },
      }),
      extensions: {
        authorization: {
          host: new URL(getAppSyncEndpoint()).hostname,
          Authorization: state.idToken,
        },
      },
    },
  }

  console.log('[Guess Realtime] Sending subscription request for owner:', owner)
  state.ws.send(JSON.stringify(subscriptionMessage))
}

/**
 * Unsubscribe from AppSync for a specific user.
 */
function unsubscribe(owner: string): void {
  const state = subscriptionStates.get(owner)
  if (!state || !state.ws || !state.subscriptionId) {
    return
  }

  console.log(
    '[Guess Realtime] Unsubscribing:',
    state.subscriptionId,
    'for owner:',
    owner
  )

  state.ws.send(
    JSON.stringify({
      id: state.subscriptionId,
      type: 'stop',
    })
  )

  state.subscriptionId = null
}

/**
 * Disconnect from AppSync WebSocket for a specific user.
 */
function disconnect(owner: string): void {
  const state = subscriptionStates.get(owner)
  if (!state) {
    return
  }

  if (!state.ws) {
    return
  }

  console.log('[Guess Realtime] Disconnecting for owner:', owner)

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }

  unsubscribe(owner)
  state.ws.close()
  state.ws = null

  // Clean up state if no subscribers
  if (state.subscribers.size === 0) {
    subscriptionStates.delete(owner)
  }
}

/**
 * Ensures a subscription to guess update events for a specific user.
 * Call this to subscribe to guess settlement events.
 */
export function ensureGuessSubscription(
  owner: string,
  idToken: string,
  callbacks: SubscriptionCallbacks
): SubscriptionHandle {
  const { onGuessUpdate, onError } = callbacks

  // Get or create state for this owner
  let state = subscriptionStates.get(owner)
  if (!state) {
    state = {
      ws: null,
      subscriptionId: null,
      reconnectTimer: null,
      subscribers: new Set(),
      idToken,
      owner,
    }
    subscriptionStates.set(owner, state)
  }

  // Add this subscriber
  state.subscribers.add(onGuessUpdate)

  console.log(
    `[Guess Realtime] Subscriber added for owner ${owner} (total: ${state.subscribers.size})`
  )

  // Connect if not already connected
  if (!state.ws) {
    connect(owner, idToken, onError)
  } else if (state.ws.readyState === WebSocket.OPEN && !state.subscriptionId) {
    // If we're already connected but not subscribed (e.g. after a complete),
    // ensure we re-subscribe when a new subscriber arrives.
    subscribe(owner)
  }

  // Return handle to remove this subscriber
  return {
    stop: () => {
      const currentState = subscriptionStates.get(owner)
      if (!currentState) {
        return
      }

      currentState.subscribers.delete(onGuessUpdate)

      console.log(
        `[Guess Realtime] Subscriber removed for owner ${owner} (remaining: ${currentState.subscribers.size})`
      )

      // If no more subscribers, clean up after grace period
      if (currentState.subscribers.size === 0) {
        const CLEANUP_GRACE_MS = 30_000 // 30 seconds

        console.log(
          `[Guess Realtime] No subscribers for owner ${owner}, scheduling cleanup in ${CLEANUP_GRACE_MS}ms`
        )

        setTimeout(() => {
          const stateAfterDelay = subscriptionStates.get(owner)
          if (stateAfterDelay && stateAfterDelay.subscribers.size === 0) {
            disconnect(owner)
            console.log('[Guess Realtime] Client disposed for owner:', owner)
          }
        }, CLEANUP_GRACE_MS)
      }
    },
  }
}
