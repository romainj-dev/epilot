import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { assertAppSyncSuccess, callAppSync } from '@/lib/appsync'

type UpsertUserStateInput = {
  username: string
  score: number
  streak: number
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
    getUserState?: unknown
  }>({ query, variables: { id: userId }, idToken })

  try {
    assertAppSyncSuccess(result, 'AppSync get user state failed')
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
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
    getUserState?: { id?: string } | null
  }>({ query: getQuery, variables: { id: userId }, idToken })

  try {
    assertAppSyncSuccess(existing, 'AppSync lookup user state failed')
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
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
    updateUserState?: unknown
  }>({
    query: mutation,
    variables: {
      input: {
        id: userId,
        score,
        streak,
        lastUpdatedAt: now,
      },
    },
    idToken,
  })

  try {
    assertAppSyncSuccess(result, 'AppSync update user state failed')
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    item: result.data?.updateUserState ?? null,
  })
}
