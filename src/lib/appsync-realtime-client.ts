import 'server-only'

import { type DocumentNode, print } from 'graphql'
import { WebSocket, type RawData } from 'ws'

/**
 * Generic AppSync WebSocket realtime subscription client.
 *
 * Provides a reusable foundation for AppSync subscriptions with:
 * - Type-safe subscription management
 * - Automatic reconnection
 * - Per-owner or global subscription support
 * - API key or Cognito authentication
 * - Graceful cleanup with configurable grace periods
 */

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Base64-encode data and URL-encode the result for safe query param transmission.
 * AppSync requires base64-encoded auth headers in the WebSocket URL.
 */
function encodeBase64(data: unknown): string {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(data)).toString('base64')
  )
}

/**
 * Convert WebSocket RawData to string.
 */
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

// ============================================================================
// APPSYNC PROTOCOL TYPES
// ============================================================================

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
      payload?: { data?: Record<string, unknown>; errors?: unknown }
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

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

/**
 * AppSync authentication configuration.
 * Supports both API key and Cognito user pool authentication.
 */
export type AppSyncAuthConfig =
  | { type: 'API_KEY'; apiKey: string }
  | { type: 'COGNITO_USER_POOLS'; idToken: string }

/**
 * Convert AppSync HTTP endpoint to realtime WebSocket endpoint with auth.
 */
function getAppSyncRealtimeUrl(
  httpEndpoint: string,
  auth: AppSyncAuthConfig
): string {
  const url = new URL(httpEndpoint)
  const host = url.hostname.replace('appsync-api', 'appsync-realtime-api')

  const header =
    auth.type === 'API_KEY'
      ? { host: url.hostname, 'x-api-key': auth.apiKey }
      : { host: url.hostname, Authorization: auth.idToken }

  const encodedHeader = encodeBase64(header)
  const encodedPayload = encodeBase64({})

  return `wss://${host}${url.pathname}?header=${encodedHeader}&payload=${encodedPayload}`
}

/**
 * Build authorization extensions for subscription message.
 */
function getAuthExtensions(
  httpEndpoint: string,
  auth: AppSyncAuthConfig
): Record<string, unknown> {
  const host = new URL(httpEndpoint).hostname

  if (auth.type === 'API_KEY') {
    return {
      host,
      'x-api-key': auth.apiKey,
    }
  }

  return {
    host,
    Authorization: auth.idToken,
  }
}

// ============================================================================
// SUBSCRIPTION CONFIGURATION
// ============================================================================

/**
 * Configuration for a GraphQL subscription.
 */
export interface SubscriptionConfig<TData> {
  /** The GraphQL subscription document */
  document: DocumentNode
  /** Operation name (must match document) */
  operationName: string
  /** GraphQL variables */
  variables?: Record<string, unknown>
  /** Extract subscription data from AppSync message */
  extractData: (payload: Record<string, unknown>) => unknown
  /** Validate and type-narrow the extracted data */
  validateData: (data: unknown) => data is TData
  /** Filter predicate (return false to skip broadcasting) */
  filterData?: (data: TData) => boolean
}

// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================

export interface AppSyncRealtimeClientConfig<TData> {
  /** AppSync HTTP endpoint */
  endpoint: string
  /** Authentication configuration */
  auth: AppSyncAuthConfig
  /** Subscription configuration */
  subscription: SubscriptionConfig<TData>
  /** Grace period (ms) before disconnecting after last subscriber leaves */
  cleanupGraceMs?: number
  /** Reconnect delay (ms) after unexpected disconnection */
  reconnectDelayMs?: number
  /** Log prefix for debugging */
  logPrefix?: string
}

// ============================================================================
// CLIENT STATE
// ============================================================================

interface ClientState<TData> {
  ws: WebSocket | null
  subscriptionId: string | null
  reconnectTimer: NodeJS.Timeout | null
  subscribers: Set<DataCallback<TData>>
  config: AppSyncRealtimeClientConfig<TData>
}

// ============================================================================
// PUBLIC API
// ============================================================================

export type DataCallback<TData> = (data: TData) => void

export interface SubscriptionCallbacks<TData> {
  onData: DataCallback<TData>
  onError?: (error: Error) => void
}

export interface SubscriptionHandle {
  stop: () => void
}

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

/**
 * Generic AppSync realtime subscription client.
 *
 * Manages a single WebSocket connection per owner (or globally if owner is null).
 * Supports multiple subscribers sharing the same connection.
 */
export class AppSyncRealtimeClient<TData> {
  private readonly states = new Map<string | null, ClientState<TData>>()
  private readonly defaultConfig: Required<
    Pick<
      AppSyncRealtimeClientConfig<TData>,
      'cleanupGraceMs' | 'reconnectDelayMs' | 'logPrefix'
    >
  > = {
    cleanupGraceMs: 30_000,
    reconnectDelayMs: 5_000,
    logPrefix: '[AppSync Realtime]',
  }

  /**
   * Subscribe to realtime updates.
   *
   * @param config - Client configuration
   * @param callbacks - Data and error callbacks
   * @param owner - Optional owner ID for per-user subscriptions (null for global)
   * @returns Handle to stop the subscription
   */
  subscribe(
    config: AppSyncRealtimeClientConfig<TData>,
    callbacks: SubscriptionCallbacks<TData>,
    owner: string | null = null
  ): SubscriptionHandle {
    const { onData, onError } = callbacks
    const mergedConfig = { ...this.defaultConfig, ...config }

    // Get or create state for this owner
    let state = this.states.get(owner)
    if (!state) {
      state = {
        ws: null,
        subscriptionId: null,
        reconnectTimer: null,
        subscribers: new Set(),
        config: mergedConfig,
      }
      this.states.set(owner, state)
    }

    // Add subscriber
    state.subscribers.add(onData)
    this.log(
      mergedConfig.logPrefix,
      `Subscriber added${owner ? ` for owner ${owner}` : ''} (total: ${state.subscribers.size})`
    )

    // Connect if not already connected
    if (!state.ws) {
      this.connect(owner, mergedConfig, onError)
    } else if (
      state.ws.readyState === WebSocket.OPEN &&
      !state.subscriptionId
    ) {
      // Already connected but not subscribed - re-subscribe
      this.subscribeToAppSync(owner, mergedConfig)
    }

    // Return cleanup handle
    return {
      stop: () => {
        const currentState = this.states.get(owner)
        if (!currentState) {
          return
        }

        currentState.subscribers.delete(onData)
        this.log(
          mergedConfig.logPrefix,
          `Subscriber removed${owner ? ` for owner ${owner}` : ''} (remaining: ${currentState.subscribers.size})`
        )

        // Schedule cleanup if no more subscribers
        if (currentState.subscribers.size === 0) {
          this.log(
            mergedConfig.logPrefix,
            `No subscribers${owner ? ` for owner ${owner}` : ''}, scheduling cleanup in ${mergedConfig.cleanupGraceMs}ms`
          )

          setTimeout(() => {
            const stateAfterDelay = this.states.get(owner)
            if (stateAfterDelay && stateAfterDelay.subscribers.size === 0) {
              this.disconnect(owner, mergedConfig)
              this.log(
                mergedConfig.logPrefix,
                `Client disposed${owner ? ` for owner ${owner}` : ''}`
              )
            }
          }, mergedConfig.cleanupGraceMs)
        }
      },
    }
  }

  /**
   * Connect to AppSync WebSocket.
   */
  private connect(
    owner: string | null,
    config: Required<AppSyncRealtimeClientConfig<TData>>,
    onError?: (error: Error) => void
  ): void {
    const state = this.states.get(owner)
    if (!state || state.ws) {
      return
    }

    const url = getAppSyncRealtimeUrl(config.endpoint, config.auth)
    this.log(
      config.logPrefix,
      `Connecting to WebSocket${owner ? ` for owner ${owner}` : ''}`,
      {
        httpHost: new URL(config.endpoint).hostname,
        realtimeHost: new URL(url).hostname,
      }
    )

    state.ws = new WebSocket(url, 'graphql-ws')

    state.ws.on('open', () => {
      this.log(
        config.logPrefix,
        `WebSocket connected${owner ? ` for owner ${owner}` : ''}`
      )
      state.ws?.send(JSON.stringify({ type: 'connection_init' }))
    })

    state.ws.on('message', (data: RawData) => {
      try {
        const message = JSON.parse(rawDataToString(data))
        this.handleMessage(owner, config, message, onError)
      } catch (error) {
        console.error(`${config.logPrefix} Failed to parse message:`, error)
      }
    })

    state.ws.on('error', (error) => {
      console.error(`${config.logPrefix} WebSocket error:`, error)
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
    })

    state.ws.on('close', () => {
      this.log(
        config.logPrefix,
        `WebSocket closed${owner ? ` for owner ${owner}` : ''}`
      )
      state.ws = null
      state.subscriptionId = null

      // Attempt reconnection if there are active subscribers
      if (state.subscribers.size > 0 && !state.reconnectTimer) {
        this.log(
          config.logPrefix,
          `Scheduling reconnect in ${config.reconnectDelayMs}ms`
        )
        state.reconnectTimer = setTimeout(() => {
          state.reconnectTimer = null
          if (state.subscribers.size > 0) {
            this.connect(owner, config, onError)
          }
        }, config.reconnectDelayMs)
      }
    })
  }

  /**
   * Handle incoming AppSync messages.
   */
  private handleMessage(
    owner: string | null,
    config: Required<AppSyncRealtimeClientConfig<TData>>,
    message: unknown,
    onError?: (error: Error) => void
  ): void {
    const state = this.states.get(owner)
    if (!state) {
      return
    }

    if (!isAppSyncMessage(message)) {
      this.log(config.logPrefix, 'Unknown message:', message)
      return
    }

    switch (message.type) {
      case 'connection_ack':
        this.log(config.logPrefix, 'Connection acknowledged')
        this.subscribeToAppSync(owner, config)
        break

      case 'start_ack':
        this.log(config.logPrefix, 'Subscription started:', message.id)
        break

      case 'data': {
        if (message.payload?.errors) {
          console.error(
            `${config.logPrefix} Subscription GraphQL errors:`,
            message.payload.errors
          )
        }

        const rawData = config.subscription.extractData(
          message.payload?.data ?? {}
        )

        if (!config.subscription.validateData(rawData)) {
          break
        }

        // Apply optional filter
        if (
          config.subscription.filterData &&
          !config.subscription.filterData(rawData)
        ) {
          break
        }

        this.log(config.logPrefix, 'Received data:', rawData)

        // Broadcast to all subscribers
        state.subscribers.forEach((cb) => {
          try {
            cb(rawData)
          } catch (err) {
            console.error(`${config.logPrefix} Subscriber error:`, err)
          }
        })
        break
      }

      case 'error':
        console.error(`${config.logPrefix} Subscription error:`, message)
        if (onError) {
          onError(new Error(JSON.stringify(message.payload ?? message)))
        }
        break

      case 'ka':
        // Keep-alive, ignore
        break

      case 'complete':
        this.log(config.logPrefix, 'Subscription complete')
        state.subscriptionId = null
        break

      default: {
        // Exhaustive check
        const _exhaustive: never = message
        break
      }
    }
  }

  /**
   * Send subscription message to AppSync.
   */
  private subscribeToAppSync(
    owner: string | null,
    config: Required<AppSyncRealtimeClientConfig<TData>>
  ): void {
    const state = this.states.get(owner)
    if (!state) {
      return
    }

    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      console.error(
        `${config.logPrefix} Cannot subscribe, WebSocket not ready${owner ? ` for owner ${owner}` : ''}`
      )
      return
    }

    if (state.subscriptionId) {
      this.log(
        config.logPrefix,
        `Already subscribed${owner ? ` for owner ${owner}` : ''}`
      )
      return
    }

    state.subscriptionId = `subscription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const subscriptionMessage = {
      id: state.subscriptionId,
      type: 'start',
      payload: {
        data: JSON.stringify({
          operationName: config.subscription.operationName,
          query: print(config.subscription.document),
          variables: config.subscription.variables ?? {},
        }),
        extensions: {
          authorization: getAuthExtensions(config.endpoint, config.auth),
        },
      },
    }

    this.log(
      config.logPrefix,
      `Sending subscription request${owner ? ` for owner ${owner}` : ''}`
    )
    state.ws.send(JSON.stringify(subscriptionMessage))
  }

  /**
   * Unsubscribe from AppSync.
   */
  private unsubscribe(
    owner: string | null,
    config: Required<AppSyncRealtimeClientConfig<TData>>
  ): void {
    const state = this.states.get(owner)
    if (!state || !state.ws || !state.subscriptionId) {
      return
    }

    this.log(
      config.logPrefix,
      `Unsubscribing: ${state.subscriptionId}${owner ? ` for owner ${owner}` : ''}`
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
   * Disconnect WebSocket.
   */
  private disconnect(
    owner: string | null,
    config: Required<AppSyncRealtimeClientConfig<TData>>
  ): void {
    const state = this.states.get(owner)
    if (!state || !state.ws) {
      return
    }

    this.log(
      config.logPrefix,
      `Disconnecting${owner ? ` for owner ${owner}` : ''}`
    )

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer)
      state.reconnectTimer = null
    }

    this.unsubscribe(owner, config)
    state.ws.close()
    state.ws = null

    // Clean up state if no subscribers
    if (state.subscribers.size === 0) {
      this.states.delete(owner)
    }
  }

  /**
   * Log helper with consistent formatting.
   */
  private log(prefix: string, message: string, data?: unknown): void {
    if (data !== undefined) {
      console.log(prefix, message, data)
    } else {
      console.log(prefix, message)
    }
  }
}
