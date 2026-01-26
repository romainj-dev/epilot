import { type NextRequest } from 'next/server'

import {
  ModelSortDirection,
  PriceSnapshotsByPkDocument,
} from '@/graphql/generated/graphql'
import {
  addClient,
  removeClient,
  type StreamMessage,
} from './price-snapshot-relay'
import { fetchGraphQL } from '@/lib/requests'
import type { PriceSnapshotStream } from '@/types/price-snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SSE_KEEP_ALIVE_MS = 25_000
const PRICE_SNAPSHOT_PK = 'PriceSnapshot'

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
    async start(controller) {
      let isClosed = false

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
        removeClient(send)
        controller.close()
      }

      req.signal.addEventListener('abort', close)

      // Register with relay to receive broadcast updates
      addClient(send)

      // Send initial snapshot immediately so clients don't wait
      try {
        const initialSnapshot = await queryLatestPriceSnapshot()
        send({ type: 'snapshot', payload: initialSnapshot })
      } catch (error) {
        console.error('[SSE] Failed to fetch initial snapshot:', error)
        send({
          type: 'error',
          payload: { message: (error as Error).message },
        })
      }
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
