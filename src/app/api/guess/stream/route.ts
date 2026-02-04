import { type NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { createSSEStream, createSSEResponse } from '@/lib/sse-relay'
import { addGuessClient, removeGuessClient } from './guess-relay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/guess/stream
 *
 * Server-Sent Events endpoint that streams guess settlement updates
 * for the authenticated user.
 *
 * Requires authentication. Uses the user's Cognito ID token to subscribe
 * to their personal guess updates via AppSync WebSocket.
 */
export async function GET(req: NextRequest) {
  // Authenticate user
  const session = await auth()

  if (!session?.user?.id || !session?.cognitoIdToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  const owner = session.user.id
  const idToken = session.cognitoIdToken

  const stream = createSSEStream(req, {
    // TODO start the stream only after 60sec + keepAliveMs: 1_000,
    async onStart(send) {
      // Register with the user-specific relay
      addGuessClient(owner, idToken, send)

      console.log(`[Guess SSE] Client connected for owner: ${owner}`)
    },
    onClose(send) {
      // Unregister from the relay
      removeGuessClient(owner, send)
      console.log(`[Guess SSE] Client disconnected for owner: ${owner}`)
    },
    logPrefix: `[Guess SSE:${owner}]`,
  })

  return createSSEResponse(stream)
}
