/**
 * UserStateProvider - User score and statistics data
 *
 * Fetches and provides access to user's game statistics (score, guess counts, etc).
 * Refetched after each settled guess to update the score display.
 */

'use client'

import { createContext, useContext } from 'react'
import { useQuery as useTanstackQuery } from '@tanstack/react-query'
import {
  GetUserStateDocument,
  type GetUserStateQuery,
} from '@/graphql/generated/graphql'
import { fetchGraphQLClient, type GraphQLError } from '@/lib/requests-client'
import { queryKeys } from '@/lib/query-keys'

type UserState = GetUserStateQuery['getUserState']

type UserStateContextValue = {
  userState: UserState
  isLoading: boolean
  error: Error | null
}

const UserStateContext = createContext<UserStateContextValue | null>(null)

interface UserStateProviderProps {
  userId: string
  children: React.ReactNode
}

export function UserStateProvider({
  userId,
  children,
}: UserStateProviderProps) {
  const { data, isLoading, error } = useTanstackQuery<
    GetUserStateQuery,
    GraphQLError
  >({
    queryKey: queryKeys.userState.get(userId),
    queryFn: () => fetchGraphQLClient(GetUserStateDocument, { id: userId }),
  })

  const value = {
    userState: data?.getUserState ?? null,
    isLoading,
    error,
  }

  return (
    <UserStateContext.Provider value={value}>
      {children}
    </UserStateContext.Provider>
  )
}

export function useUserState() {
  const context = useContext(UserStateContext)
  if (!context) {
    throw new Error('useUserState must be used within UserStateProvider')
  }
  return context
}
