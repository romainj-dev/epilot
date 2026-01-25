import { type NextRequest } from 'next/server'

import {
  ModelSortDirection,
  PriceSnapshotsByPkDocument,
} from '@/graphql/generated/graphql'
import { fetchGraphQL } from '@/lib/requests'
import type { PriceSnapshotStream } from '@/types/price-snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SSE_KEEP_ALIVE_MS = 25_000
const POLL_INTERVAL_MS = 60_000
const PRICE_SNAPSHOT_PK = 'PriceSnapshot'

type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshotStream | null }
  | { type: 'error'; payload: { message: string } }

/**
 * Fetch the latest price snapshot via the GSI on capturedAt.
 */
async function queryLatestPriceSnapshot(): Promise<PriceSnapshotStream | null> {
  const variables = {
    pk: PRICE_SNAPSHOT_PK,
    limit: 1,
    sortDirection: ModelSortDirection.Desc,
  }

  const data = await fetchGraphQL({
    document: PriceSnapshotsByPkDocument,
    variables,
  })

  return data.priceSnapshotsByPk?.items[0] ?? null
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false
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
        if (pollInterval) {
          clearInterval(pollInterval)
        }
        controller.close()
      }

      req.signal.addEventListener('abort', close)

      const pollLatest = () => {
        queryLatestPriceSnapshot()
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
