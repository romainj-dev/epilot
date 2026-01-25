import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { assertAppSyncSuccess, callAppSync } from '@/lib/appsync'

type CreateGuessInput = {
  guessPrice: number
  startPrice: number
  settleAt: string
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined

  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = /* GraphQL */ `
    query ListGuesses($limit: Int) {
      listGuesses(limit: $limit) {
        items {
          id
          createdAt
          settleAt
          guessPrice
          startPrice
          endPrice
          status
          result
        }
      }
    }
  `

  const result = await callAppSync<{
    listGuesses?: { items: unknown[] }
  }>({ query, variables: { limit: 10 }, idToken })

  try {
    assertAppSyncSuccess(result, 'AppSync list guesses failed')
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }

  return NextResponse.json({ items: result.data?.listGuesses?.items ?? [] })
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const idToken = token?.cognitoIdToken as string | undefined

  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as CreateGuessInput
  const { guessPrice, startPrice, settleAt } = body

  if (!guessPrice || !startPrice || !settleAt) {
    return NextResponse.json(
      { error: 'Missing guessPrice, startPrice, or settleAt' },
      { status: 400 }
    )
  }

  const query = /* GraphQL */ `
    mutation CreateGuess($input: CreateGuessInput!) {
      createGuess(input: $input) {
        id
        createdAt
        settleAt
        guessPrice
        startPrice
        endPrice
        status
        result
      }
    }
  `

  const result = await callAppSync<{
    createGuess?: unknown
  }>({
    query,
    variables: {
      input: {
        guessPrice,
        startPrice,
        settleAt,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      },
    },
    idToken,
  })

  try {
    assertAppSyncSuccess(result, 'AppSync create guess failed')
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }

  return NextResponse.json({ item: result.data?.createGuess ?? null })
}
