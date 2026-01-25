import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    error?: 'RefreshTokenError'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    cognitoIdToken?: string
    cognitoRefreshToken?: string
    cognitoTokenExpiry?: number
    error?: 'RefreshTokenError'
  }
}
