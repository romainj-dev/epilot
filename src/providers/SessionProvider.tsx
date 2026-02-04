/**
 * SessionProvider - NextAuth session context wrapper
 *
 * Provides authentication state to the entire app.
 * Wrapper allows for potential future customization of NextAuth configuration.
 */

'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
