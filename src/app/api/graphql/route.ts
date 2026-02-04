/**
 * POST /api/graphql
 *
 * GraphQL proxy endpoint for client-side requests to AppSync.
 * Adds user authentication and forwards operations to AppSync backend.
 *
 * Auth: Required (Cognito ID token via NextAuth session)
 * Body: { query: string, variables?: object, operationName?: string }
 * Response: Standard GraphQL response { data } or { errors }
 */

import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { AppSyncError, fetchGraphQLProxy } from '@/lib/requests'

export const runtime = 'nodejs'

type GraphQLRequest = {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const idToken = session?.cognitoIdToken

  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as GraphQLRequest
    const { query, variables } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query' },
        { status: 400 }
      )
    }

    const data = await fetchGraphQLProxy({
      query,
      variables,
      idToken,
    })

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof AppSyncError) {
      return NextResponse.json(
        { errors: error.errors ?? [{ message: error.message }] },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { errors: [{ message: (error as Error).message ?? 'Internal error' }] },
      { status: 500 }
    )
  }
}
