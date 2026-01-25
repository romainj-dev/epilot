import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

type CognitoIdTokenPayload = {
  sub?: string
  email?: string
  exp?: number
}

const region = process.env.AWS_REGION
const clientId = process.env.COGNITO_CLIENT_ID

if (!region || !clientId) {
  throw new Error('Missing AWS_REGION or COGNITO_CLIENT_ID env vars.')
}

const cognito = new CognitoIdentityProviderClient({ region })

const AUTH_SECRET = process.env.AUTH_SECRET

if (!AUTH_SECRET) {
  throw new Error('Missing AUTH_SECRET env var.')
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
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
        const email = (credentials?.email as string)?.toLowerCase().trim()
        const password = credentials?.password as string

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
        const refreshToken = response.AuthenticationResult?.RefreshToken
        if (!idToken) {
          // MFA or other challenges are not handled in MVP.
          return null
        }

        const payload = decodeIdTokenPayload(idToken)
        const userId = payload?.sub ?? email
        const userEmail = payload?.email ?? email
        const cognitoTokenExpiry = payload?.exp

        return {
          id: userId,
          email: userEmail,
          cognitoIdToken: idToken,
          cognitoRefreshToken: refreshToken,
          cognitoTokenExpiry,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const authUser = user as {
        id?: string
        cognitoIdToken?: string
        cognitoRefreshToken?: string
        cognitoTokenExpiry?: number
      } | null

      // Initial sign-in: store all tokens
      if (authUser?.id) {
        token.userId = authUser.id
        token.cognitoIdToken = authUser.cognitoIdToken
        token.cognitoRefreshToken = authUser.cognitoRefreshToken
        token.cognitoTokenExpiry = authUser.cognitoTokenExpiry
        return token
      }

      // Check if Cognito token needs refresh (with 60s buffer)
      const cognitoExpiry = token.cognitoTokenExpiry as number | undefined
      const now = Math.floor(Date.now() / 1000)

      if (cognitoExpiry && now >= cognitoExpiry - 60) {
        // Token expired or about to expire - refresh it
        const refreshToken = token.cognitoRefreshToken as string | undefined
        if (refreshToken) {
          try {
            const response = await cognito.send(
              new InitiateAuthCommand({
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                ClientId: clientId,
                AuthParameters: {
                  REFRESH_TOKEN: refreshToken,
                },
              })
            )

            const newIdToken = response.AuthenticationResult?.IdToken
            if (newIdToken) {
              const payload = decodeIdTokenPayload(newIdToken)
              token.cognitoIdToken = newIdToken
              token.cognitoTokenExpiry = payload?.exp
            }
          } catch (error) {
            console.error('Failed to refresh Cognito token:', error)
            // Return token with error flag - forces re-login
            return { ...token, error: 'RefreshTokenError' as const }
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      // Expose cognitoIdToken and cognitoTokenExpiry for server-side use
      session.cognitoIdToken = token.cognitoIdToken as string | undefined
      session.cognitoTokenExpiry = token.cognitoTokenExpiry as
        | number
        | undefined

      if (session.user) {
        session.user.id = token.userId as string
      }
      // Expose error to client so it can trigger re-login
      if (token.error) {
        session.error = token.error as 'RefreshTokenError'
      }
      return session
    },
  },
})

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
