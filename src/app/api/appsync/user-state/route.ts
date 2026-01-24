import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const endpoint = process.env.APPSYNC_ENDPOINT as string

if (!endpoint) {
  throw new Error('Missing APPSYNC_ENDPOINT env var.')
}

type UpsertUserStateInput = {
  username: string
  score: number
  streak: number
}

async function callAppSync<T>(
  query: string,
  variables: Record<string, unknown>,
  idToken: string
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: idToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  const json = (await response.json()) as T
  return json
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined
  const userId = token?.userId as string | undefined

  if (!idToken || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = /* GraphQL */ `
    query GetUserState($id: ID!) {
      getUserState(id: $id) {
        id
        email
        username
        score
        streak
        lastUpdatedAt
      }
    }
  `

  const result = await callAppSync<{
    data?: { getUserState?: unknown }
    errors?: unknown[]
  }>(query, { id: userId }, idToken)

  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 500 })
  }

  return NextResponse.json({ item: result.data?.getUserState ?? null })
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined
  const userId = token?.userId as string | undefined

  if (!idToken || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as UpsertUserStateInput
  const { score, streak } = body

  if (typeof score !== 'number' || typeof streak !== 'number') {
    return NextResponse.json(
      { error: 'Missing score or streak' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  const getQuery = /* GraphQL */ `
    query GetUserState($id: ID!) {
      getUserState(id: $id) {
        id
      }
    }
  `

  const existing = await callAppSync<{
    data?: { getUserState?: { id?: string } | null }
    errors?: unknown[]
  }>(getQuery, { id: userId }, idToken)

  if (existing.errors) {
    return NextResponse.json({ errors: existing.errors }, { status: 500 })
  }

  if (!existing.data?.getUserState) {
    return NextResponse.json(
      { error: 'UserState not found for user.' },
      { status: 404 }
    )
  }

  const mutation = /* GraphQL */ `
    mutation UpdateUserState($input: UpdateUserStateInput!) {
      updateUserState(input: $input) {
        id
        email
        username
        score
        streak
        lastUpdatedAt
      }
    }
  `

  const result = await callAppSync<{
    data?: { updateUserState?: unknown }
    errors?: unknown[]
  }>(
    mutation,
    {
      input: {
        id: userId,
        score,
        streak,
        lastUpdatedAt: now,
      },
    },
    idToken
  )

  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 500 })
  }

  return NextResponse.json({
    item: result.data?.updateUserState ?? null,
  })
}
