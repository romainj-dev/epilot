/**
 * POST /api/cognito/confirm
 *
 * Email verification endpoint for confirming user sign-up.
 * Completes the Cognito registration flow with the emailed verification code.
 *
 * Auth: Public (no authentication required)
 * Body: { email: string, code: string }
 * Response: { ok: true } on success, { error: string } on failure
 */

import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

import { getAwsRegion, getCognitoClientId } from '@/lib/env'

type ConfirmRequestBody = {
  email: string | undefined
  code: string | undefined
}

function getCognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region: getAwsRegion() })
}

export async function POST(request: Request) {
  const body = (await request.json()) as ConfirmRequestBody
  const { email, code } = body

  if (!email?.trim() || !code?.trim()) {
    return NextResponse.json(
      { error: 'email and code are required' },
      { status: 400 }
    )
  }

  const username = String(email).toLowerCase().trim()
  const cognito = getCognitoClient()
  const clientId = getCognitoClientId()

  try {
    await cognito.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: String(code).trim(),
      })
    )
  } catch (error) {
    console.error('ConfirmSignUp failed', error)
    const errorCode =
      error instanceof Error && error.name !== 'Error'
        ? error.name
        : 'ConfirmSignUpFailed'
    return NextResponse.json({ error: errorCode }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
