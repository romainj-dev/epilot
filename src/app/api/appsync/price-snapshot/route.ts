import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { assertAppSyncSuccess, callAppSync } from '@/lib/appsync'
import type { PriceSnapshot } from '@/types/price-snapshot'

export const runtime = 'nodejs'

const PRICE_SNAPSHOT_PK = 'PriceSnapshot'
/**
 * Fetch the latest price snapshot via the GSI on capturedAt.
 */
export async function queryLatestPriceSnapshot(idToken: string) {
  const query = /* GraphQL */ `
    query PriceSnapshotsByPk(
      $pk: String!
      $limit: Int
      $sortDirection: ModelSortDirection
    ) {
      priceSnapshotsByPk(
        pk: $pk
        limit: $limit
        sortDirection: $sortDirection
      ) {
        items {
          id
          pk
          capturedAt
          sourceUpdatedAt
          priceUsd
          source
        }
      }
    }
  `

  const result = await callAppSync<{
    priceSnapshotsByPk?: { items?: PriceSnapshot[] }
  }>({
    query,
    variables: { pk: PRICE_SNAPSHOT_PK, limit: 1, sortDirection: 'DESC' },
    idToken,
  })

  assertAppSyncSuccess(result, 'AppSync price snapshot query failed')

  return result.data?.priceSnapshotsByPk?.items?.[0] ?? null
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined

  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const item = await queryLatestPriceSnapshot(idToken)
    return NextResponse.json({ item })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? 'Failed to load snapshot' },
      { status: 500 }
    )
  }
}
