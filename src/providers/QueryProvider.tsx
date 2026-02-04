/**
 * QueryProvider - React Query configuration and context
 *
 * Provides data-fetching capabilities throughout the app with centralized defaults:
 * - Conservative retries (skip 4xx errors, exponential backoff)
 * - 60s default stale time
 * - No automatic refetch on window focus (prevents excessive requests)
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors (client errors)
              if (error instanceof Error && /4\d{2}/.test(error.message)) {
                return false
              }
              return failureCount < 3
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
