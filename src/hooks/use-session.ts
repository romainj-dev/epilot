/**
 * useSession - NextAuth session wrapper
 *
 * Provides user authentication state throughout the app.
 * Wrapper exists for potential future customization and to centralize the import.
 */

'use client'

import { useSession as useNextAuthSession } from 'next-auth/react'

export function useSession() {
  return useNextAuthSession()
}
