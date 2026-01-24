import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.AWS_REGION
const clientId = process.env.COGNITO_CLIENT_ID

if (!region || !clientId) {
  throw new Error('Missing AWS_REGION or COGNITO_CLIENT_ID env vars.')
}

const cognito = new CognitoIdentityProviderClient({ region })

export async function POST(request: Request) {
  const { email, code } = await request.json()

  if (!email || !code) {
    return NextResponse.json(
      { error: 'email and code are required' },
      { status: 400 }
    )
  }

  const username = String(email).toLowerCase().trim()

  try {
    await cognito.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: String(code).trim(),
      })
    )
  } catch (error) {
    const err = error as { name?: string; message?: string }
    console.error('ConfirmSignUp failed', err)
    return NextResponse.json(
      { error: err?.name ?? 'ConfirmSignUpFailed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
