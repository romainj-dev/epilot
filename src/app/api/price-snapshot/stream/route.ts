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
import { createSSEStream, createSSEResponse } from '@/lib/sse-relay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const stream = createSSEStream<StreamMessage>(req, {
    async onStart(send) {
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
    onClose(send) {
      removeClient(send)
    },
  })

  return createSSEResponse(stream)
}
