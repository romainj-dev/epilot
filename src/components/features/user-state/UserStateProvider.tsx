'use client'

import { createContext, useContext } from 'react'
import { useQuery } from '@/hooks/requests'
import {
  GetUserStateDocument,
  type GetUserStateQuery,
} from '@/graphql/generated/graphql'

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
  const { data, isLoading, error } = useQuery(GetUserStateDocument, {
    id: userId,
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
