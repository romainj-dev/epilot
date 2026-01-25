import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    cognitoIdToken?: string
    cognitoTokenExpiry?: number
    error?: 'RefreshTokenError'
    user?: {
      id: string
      name?: string | null
      email?: string | null
    }
  }

  interface User {
    cognitoIdToken?: string
    cognitoRefreshToken?: string
    cognitoTokenExpiry?: number
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
