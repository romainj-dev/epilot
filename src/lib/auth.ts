import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

type CognitoIdTokenPayload = {
  sub?: string
  email?: string
}

const region = process.env.AWS_REGION
const clientId = process.env.COGNITO_CLIENT_ID

if (!region || !clientId) {
  throw new Error('Missing AWS_REGION or COGNITO_CLIENT_ID env vars.')
}

const cognito = new CognitoIdentityProviderClient({ region })

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth' },
  providers: [
    Credentials({
      name: 'EmailPassword',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim()
        const password = credentials?.password

        if (!email || !password) return null

        const response = await cognito.send(
          new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          })
        )

        const idToken = response.AuthenticationResult?.IdToken
        if (!idToken) {
          // MFA or other challenges are not handled in MVP.
          return null
        }

        const payload = decodeIdTokenPayload(idToken)
        const userId = payload?.sub ?? email

        return {
          id: userId,
          email: payload?.email ?? email,
          cognitoIdToken: idToken,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const authUser = user as { id?: string; cognitoIdToken?: string } | null
      if (authUser?.id) token.userId = authUser.id
      if (authUser?.cognitoIdToken) {
        token.cognitoIdToken = authUser.cognitoIdToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.userId as
          | string
          | undefined
      }
      return session
    },
  },
}

function decodeIdTokenPayload(token: string): CognitoIdTokenPayload | null {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(normalized, 'base64').toString('utf8')
    return JSON.parse(json) as CognitoIdTokenPayload
  } catch {
    return null
  }
}
