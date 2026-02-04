import 'server-only'

/**
 * Generic SSE message type
 */
export type SSEMessage = {
  type: string
  payload: unknown
}

/**
 * Client send function type
 */
export type ClientSendFunction<T extends SSEMessage = SSEMessage> = (
  message: T
) => void

/**
 * Relay state management for SSE clients
 */
export type RelayState<T extends SSEMessage = SSEMessage> = {
  clients: Set<ClientSendFunction<T>>
  upstreamHandle: { stop: () => void } | null
}

/**
 * Create a new relay state object
 */
export function createRelayState<
  T extends SSEMessage = SSEMessage,
>(): RelayState<T> {
  return {
    clients: new Set(),
    upstreamHandle: null,
  }
}

/**
 * Broadcast a message to all connected SSE clients
 */
export function broadcast<T extends SSEMessage>(
  relay: RelayState<T>,
  message: T,
  logPrefix = '[Relay]'
): void {
  console.log(
    `${logPrefix} Broadcasting to ${relay.clients.size} client(s):`,
    message.type
  )

  relay.clients.forEach((send) => {
    try {
      send(message)
    } catch (error) {
      console.error(`${logPrefix} Failed to send to client:`, error)
    }
  })
}

/**
 * Add a client to the relay and optionally start upstream subscription
 */
export function addClient<T extends SSEMessage>(
  relay: RelayState<T>,
  send: ClientSendFunction<T>,
  startUpstream?: () => void,
  logPrefix = '[Relay]'
): void {
  relay.clients.add(send)

  console.log(`${logPrefix} Client added (total: ${relay.clients.size})`)

  // Start upstream if this is the first client and startUpstream is provided
  if (relay.clients.size === 1 && startUpstream) {
    startUpstream()
  }
}

/**
 * Remove a client from the relay and optionally stop upstream subscription
 */
export function removeClient<T extends SSEMessage>(
  relay: RelayState<T>,
  send: ClientSendFunction<T>,
  stopUpstream?: () => void,
  logPrefix = '[Relay]'
): void {
  relay.clients.delete(send)

  console.log(`${logPrefix} Client removed (remaining: ${relay.clients.size})`)

  // Stop upstream if no clients remain and stopUpstream is provided
  if (relay.clients.size === 0 && stopUpstream) {
    stopUpstream()
  }
}

/**
 * Create an SSE ReadableStream with keep-alive
 */
export type CreateSSEStreamOptions<T extends SSEMessage> = {
  onStart: (send: ClientSendFunction<T>) => Promise<void> | void
  onClose: (send: ClientSendFunction<T>) => void
  keepAliveMs?: number
  logPrefix?: string
}

export function createSSEStream<T extends SSEMessage>(
  req: Request,
  options: CreateSSEStreamOptions<T>
): ReadableStream {
  const { onStart, onClose, keepAliveMs = 5_000, logPrefix = '[SSE]' } = options

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let isClosed = false

      const keepAlive = setInterval(() => {
        if (isClosed) {
          return
        }
        controller.enqueue(encoder.encode(': keep-alive\n\n'))
      }, keepAliveMs)

      const send: ClientSendFunction<T> = (message) => {
        if (isClosed) {
          console.log(`${logPrefix} Stream closed, not sending:`, message.type)
          return
        }
        console.log(
          `${logPrefix} Sending event:`,
          message.type,
          typeof message.payload === 'object'
            ? JSON.stringify(message.payload).slice(0, 100)
            : String(message.payload)
        )
        controller.enqueue(
          encoder.encode(
            `event: ${message.type}\ndata: ${JSON.stringify(message.payload)}\n\n`
          )
        )
      }

      const close = () => {
        if (isClosed) {
          return
        }
        console.log(`${logPrefix} Closing stream`)
        isClosed = true
        clearInterval(keepAlive)
        onClose(send)
        controller.close()
      }

      // Request abort handling
      if ('signal' in req && req.signal) {
        req.signal.addEventListener('abort', close)
      }

      // Initialize the stream (register with relay, send initial data, etc.)
      try {
        await onStart(send)
      } catch (error) {
        console.error(`${logPrefix} Error during stream start:`, error)
        // Note: We cannot send error message here as we don't know the exact type structure
        close()
      }
    },
    cancel() {
      // The abort listener handles cleanup
    },
  })
}

/**
 * Create a standard SSE Response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
