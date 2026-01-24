import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const endpoint = process.env.APPSYNC_ENDPOINT as string

if (!endpoint) {
  throw new Error('Missing APPSYNC_ENDPOINT env var.')
}

type CreateGuessInput = {
  guessPrice: number
  startPrice: number
  settleAt: string
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
    data?: { listGuesses?: { items: unknown[] } }
    errors?: unknown[]
  }>(query, { limit: 10 }, idToken)

  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 500 })
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
    data?: { createGuess?: unknown }
    errors?: unknown[]
  }>(
    query,
    {
      input: {
        guessPrice,
        startPrice,
        settleAt,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
      },
    },
    idToken
  )

  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 500 })
  }

  return NextResponse.json({ item: result.data?.createGuess ?? null })
}
