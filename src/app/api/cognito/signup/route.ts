import { NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.AWS_REGION
const clientId = process.env.COGNITO_CLIENT_ID

if (!region || !clientId) {
  throw new Error('Missing AWS_REGION or COGNITO_CLIENT_ID env vars.')
}

const cognito = new CognitoIdentityProviderClient({ region })

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 }
    )
  }

  const username = String(email).toLowerCase().trim()

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
