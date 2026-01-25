import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { AppSyncError, fetchGraphQLProxy } from '@/lib/requests'

export const runtime = 'nodejs'

type GraphQLRequest = {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined

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
        { status: 200 } // GraphQL convention: return 200 with errors
      )
    }

    return NextResponse.json(
      { errors: [{ message: (error as Error).message ?? 'Internal error' }] },
      { status: 500 }
    )
  }
}
