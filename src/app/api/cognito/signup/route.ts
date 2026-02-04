/**
 * POST /api/cognito/signup
 *
 * User registration endpoint for Cognito sign-up.
 * Creates a new user account requiring email confirmation.
 *
 * Auth: Public (no authentication required)
 * Body: { email: string, password: string }
 * Response: { ok: true } on success
 * Next step: Client calls /api/cognito/confirm with verification code
 */

import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

import { getAwsRegion, getCognitoClientId } from '@/lib/env'

type SignupRequestBody = {
  email: string | undefined
  password: string | undefined
}

function getCognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region: getAwsRegion() })
}

export async function POST(request: Request) {
  const body = (await request.json()) as SignupRequestBody
  const { email, password } = body

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 }
    )
  }

  const username = String(email).toLowerCase().trim()

  const cognito = getCognitoClient()
  const clientId = getCognitoClientId()

  await cognito.send(
    new SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: String(password),
      UserAttributes: [{ Name: 'email', Value: username }],
    })
  )

  return NextResponse.json({ ok: true })
}
