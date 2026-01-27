import 'server-only'

import { print } from 'graphql'
import { WebSocket, type RawData } from 'ws'

import { getAppSyncApiKey, getAppSyncEndpoint } from '@/lib/env'
import {
  OnCreatePriceSnapshotDocument,
  type OnCreatePriceSnapshotSubscription,
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
function getAppSyncRealtimeUrl(httpEndpoint: string): string {
  const url = new URL(httpEndpoint)
  const host = url.hostname.replace('appsync-api', 'appsync-realtime-api')
  const header = {
    host: url.hostname,
    'x-api-key': getAppSyncApiKey(),
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

type PriceSnapshotCallback = (
  snapshot: NonNullable<
    OnCreatePriceSnapshotSubscription['onCreatePriceSnapshot']
  >
) => void

interface SubscriptionCallbacks {
  onSnapshot: PriceSnapshotCallback
  onError?: (error: Error) => void
}

interface SubscriptionHandle {
  stop: () => void
}

let ws: WebSocket | null = null
let subscriptionId: string | null = null
let activeSubscriptionCount = 0
let reconnectTimer: NodeJS.Timeout | null = null
const subscribers = new Set<PriceSnapshotCallback>()

/**
 * Connect to AppSync realtime WebSocket.
 */
function connect(onError?: (error: Error) => void): void {
  if (ws) {
    return
  }

  const endpoint = getAppSyncEndpoint()
  const url = getAppSyncRealtimeUrl(endpoint)
  console.log('[AppSync Realtime] Connecting to WebSocket', {
    httpHost: new URL(endpoint).hostname,
    realtimeHost: new URL(url).hostname,
  })

  ws = new WebSocket(url, 'graphql-ws')

  ws.on('open', () => {
    console.log('[AppSync Realtime] WebSocket connected')
    // Send connection init message
    ws?.send(JSON.stringify({ type: 'connection_init' }))
  })

  ws.on('message', (data: RawData) => {
    try {
      const message = JSON.parse(rawDataToString(data))
      handleMessage(message, onError)
    } catch (error) {
      console.error('[AppSync Realtime] Failed to parse message:', error)
    }
  })

  ws.on('error', (error) => {
    console.error('[AppSync Realtime] WebSocket error:', error)
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  })

  ws.on('close', () => {
    console.log('[AppSync Realtime] WebSocket closed')
    ws = null
    subscriptionId = null

    // Attempt to reconnect if there are active subscribers
    if (activeSubscriptionCount > 0 && !reconnectTimer) {
      console.log('[AppSync Realtime] Scheduling reconnect in 5s')
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (activeSubscriptionCount > 0) {
          connect(onError)
        }
      }, 5000)
    }
  })
}

/**
 * Handle incoming AppSync realtime messages.
 */
type PriceSnapshot = NonNullable<
  OnCreatePriceSnapshotSubscription['onCreatePriceSnapshot']
>

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
      payload?: { data?: { onCreatePriceSnapshot?: unknown }; errors?: unknown }
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

function isPriceSnapshot(value: unknown): value is PriceSnapshot {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.id === 'string' &&
    typeof value.pk === 'string' &&
    typeof value.capturedAt === 'string' &&
    typeof value.priceUsd === 'number' &&
    // optional fields (present in subscription selection)
    (value.sourceUpdatedAt == null ||
      typeof value.sourceUpdatedAt === 'string') &&
    (value.source == null || typeof value.source === 'string')
  )
}

function handleMessage(
  message: unknown,
  onError?: (error: Error) => void
): void {
  if (!isAppSyncMessage(message)) {
    console.log('[AppSync Realtime] Unknown message:', message)
    return
  }

  switch (message.type) {
    case 'connection_ack':
      console.log('[AppSync Realtime] Connection acknowledged')
      // Now subscribe to the price snapshot updates
      subscribe()
      break

    case 'start_ack':
      console.log('[AppSync Realtime] Subscription started:', message.id)
      break

    case 'data':
      {
        if (message.payload?.errors) {
          console.error(
            '[AppSync Realtime] Subscription GraphQL errors:',
            message.payload.errors
          )
        }
        const snapshotUnknown = message.payload?.data?.onCreatePriceSnapshot
        if (!isPriceSnapshot(snapshotUnknown)) {
          break
        }
        const snapshot = snapshotUnknown
        console.log(
          '[AppSync Realtime] Received snapshot:',
          snapshot.id,
          snapshot.priceUsd
        )
        // Broadcast to all subscribers
        subscribers.forEach((cb) => {
          try {
            cb(snapshot)
          } catch (err) {
            console.error('[AppSync Realtime] Subscriber error:', err)
          }
        })
      }
      break

    case 'error':
      console.error('[AppSync Realtime] Subscription error:', message)
      if (onError) {
        onError(new Error(JSON.stringify(message.payload ?? message)))
      }
      break

    case 'ka':
      // Keep-alive message, ignore
      break

    case 'complete':
      console.log('[AppSync Realtime] Subscription complete')
      subscriptionId = null
      break

    default:
      // Exhaustive check (should be unreachable due to isAppSyncMessageType).
      // If this errors, update AppSyncMessageType/AppSyncMessage.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = message
  }
}

/**
 * Send subscription message to AppSync.
 */
function subscribe(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[AppSync Realtime] Cannot subscribe, WebSocket not ready')
    return
  }

  if (subscriptionId) {
    console.log('[AppSync Realtime] Already subscribed')
    return
  }

  subscriptionId = `subscription-${Date.now()}`

  const subscriptionMessage = {
    id: subscriptionId,
    type: 'start',
    payload: {
      data: JSON.stringify({
        operationName: 'OnCreatePriceSnapshot',
        query: print(OnCreatePriceSnapshotDocument),
        variables: {
          filter: {
            pk: { eq: 'PriceSnapshot' },
          },
        },
      }),
      extensions: {
        authorization: {
          host: new URL(getAppSyncEndpoint()).hostname,
          'x-api-key': getAppSyncApiKey(),
        },
      },
    },
  }

  console.log('[AppSync Realtime] Sending subscription request')
  ws.send(JSON.stringify(subscriptionMessage))
}

/**
 * Unsubscribe from AppSync.
 */
function unsubscribe(): void {
  if (!ws || !subscriptionId) {
    return
  }

  console.log('[AppSync Realtime] Unsubscribing:', subscriptionId)

  ws.send(
    JSON.stringify({
      id: subscriptionId,
      type: 'stop',
    })
  )

  subscriptionId = null
}

/**
 * Disconnect from AppSync WebSocket.
 */
function disconnect(): void {
  if (!ws) {
    return
  }

  console.log('[AppSync Realtime] Disconnecting')

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  unsubscribe()
  ws.close()
  ws = null
}

/**
 * Ensures a subscription to price snapshot events.
 * Call this to subscribe to price snapshot events.
 */
export function ensurePriceSnapshotSubscription(
  callbacks: SubscriptionCallbacks
): SubscriptionHandle {
  const { onSnapshot, onError } = callbacks

  // Add this subscriber
  subscribers.add(onSnapshot)
  activeSubscriptionCount++

  console.log(
    `[AppSync Realtime] Subscriber added (total: ${activeSubscriptionCount})`
  )

  // Connect if not already connected
  if (!ws) {
    connect(onError)
  } else if (ws.readyState === WebSocket.OPEN && !subscriptionId) {
    // If we're already connected but not subscribed (e.g. after a complete),
    // ensure we re-subscribe when a new subscriber arrives.
    subscribe()
  }

  // Return handle to remove this subscriber
  return {
    stop: () => {
      subscribers.delete(onSnapshot)
      activeSubscriptionCount--

      console.log(
        `[AppSync Realtime] Subscriber removed (remaining: ${activeSubscriptionCount})`
      )

      // If no more subscribers, clean up after grace period
      if (activeSubscriptionCount === 0) {
        const CLEANUP_GRACE_MS = 30_000 // 30 seconds

        console.log(
          `[AppSync Realtime] No subscribers, scheduling cleanup in ${CLEANUP_GRACE_MS}ms`
        )

        setTimeout(() => {
          if (activeSubscriptionCount === 0) {
            disconnect()
            console.log('[AppSync Realtime] Client disposed')
          }
        }, CLEANUP_GRACE_MS)
      }
    },
  }
}
