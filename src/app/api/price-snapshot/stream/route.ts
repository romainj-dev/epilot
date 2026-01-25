import { getToken } from 'next-auth/jwt'
import { type NextRequest } from 'next/server'

import { queryLatestPriceSnapshot } from '@/app/api/appsync/price-snapshot/route'
import type { PriceSnapshot } from '@/types/price-snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SSE_KEEP_ALIVE_MS = 25_000
const TOKEN_EXPIRY_BUFFER_MS = 60_000
const MAX_TIMEOUT_MS = 2_147_483_647
const POLL_INTERVAL_MS = 60_000

type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshot | null }
  | { type: 'error'; payload: { message: string } }

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined
  // Use Cognito token expiry (not NextAuth JWT exp) for accurate stream lifetime
  const tokenExpiry =
    typeof token?.cognitoTokenExpiry === 'number'
      ? token.cognitoTokenExpiry
      : null

  if (!idToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false
      let expiryTimeout: ReturnType<typeof setTimeout> | null = null
      let pollInterval: ReturnType<typeof setInterval> | null = null
      let lastSnapshotId: string | null = null
      const keepAlive = setInterval(() => {
        if (isClosed) {
          return
        }
        controller.enqueue(encoder.encode(': keep-alive\n\n'))
      }, SSE_KEEP_ALIVE_MS)

      const send = (message: StreamMessage) => {
        if (isClosed) {
          console.log('[SSE] Stream closed, not sending:', message.type)
          return
        }
        console.log(
          '[SSE] Sending event:',
          message.type,
          JSON.stringify(message.payload).slice(0, 100)
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
        console.log('[SSE] Closing stream')
        isClosed = true
        clearInterval(keepAlive)
        if (expiryTimeout) {
          clearTimeout(expiryTimeout)
        }
        if (pollInterval) {
          clearInterval(pollInterval)
        }
        controller.close()
      }

      req.signal.addEventListener('abort', close)

      if (tokenExpiry) {
        const expiresAtMs =
          tokenExpiry > 1_000_000_000_000 ? tokenExpiry : tokenExpiry * 1000
        const closeAtMs = expiresAtMs - TOKEN_EXPIRY_BUFFER_MS
        const delay = closeAtMs - Date.now()
        if (delay <= 0) {
          send({
            type: 'error',
            payload: { message: 'Auth token expired, reconnecting...' },
          })
          close()
          return
        }
        if (delay > 0 && delay <= MAX_TIMEOUT_MS) {
          expiryTimeout = setTimeout(() => {
            send({
              type: 'error',
              payload: { message: 'Auth token expired, reconnecting...' },
            })
            close()
          }, delay)
        }
      }

      const pollLatest = () => {
        queryLatestPriceSnapshot(idToken)
          .then((snapshot) => {
            if (!snapshot) {
              send({ type: 'snapshot', payload: null })
              return
            }
            if (snapshot.id !== lastSnapshotId) {
              lastSnapshotId = snapshot.id
              send({ type: 'snapshot', payload: snapshot })
            }
          })
          .catch((error) => {
            send({
              type: 'error',
              payload: { message: (error as Error).message },
            })
            if (
              (error as Error).message?.includes('Token has expired') ||
              (error as Error).message?.includes('401')
            ) {
              close()
            }
          })
      }

      pollLatest()
      pollInterval = setInterval(pollLatest, POLL_INTERVAL_MS)
    },
    cancel() {
      // The abort listener handles cleanup.
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
