import { useCallback, useEffect } from 'react'
import { useSession } from '@/hooks/use-session'
import {
  useQuery as useTanstackQuery,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query'

import { useMutation } from '@/hooks/requests'
import {
  CreateGuessDocument,
  GuessesByOwnerDocument,
  type Guess,
  type GuessesByOwnerQuery,
  type CreateGuessMutation,
  type CreateGuessMutationVariables,
  GuessStatus,
  ModelSortDirection,
} from '@/graphql/generated/graphql'
import { fetchGraphQLClient, type GraphQLError } from '@/lib/requests-client'
import { queryKeys } from '@/lib/query-keys'

// ---------------------------------------------------------------------------
// useActiveGuess - Query for the user's current PENDING guess
// ---------------------------------------------------------------------------

export function useActiveGuess() {
  const { data: session } = useSession()
  const owner = session?.user?.id

  return useTanstackQuery<Guess | null, GraphQLError>({
    queryKey: owner ? queryKeys.guess.active(owner) : ['guess', 'active'],
    queryFn: async () => {
      if (!owner) return null

      const data = await fetchGraphQLClient(GuessesByOwnerDocument, {
        owner,
        filter: { status: { eq: GuessStatus.Pending } },
        sortDirection: ModelSortDirection.Desc,
        limit: 1,
      })

      return data.guessesByOwner?.items?.[0] ?? null
    },
    enabled: !!owner,
    staleTime: Infinity, // Only update via mutation/SSE
  })
}

// ---------------------------------------------------------------------------
// useCreateGuess - Mutation to create a new guess with optimistic updates
// ---------------------------------------------------------------------------

interface CreateGuessContext {
  previousActiveGuess?: Guess | null
  optimisticGuess: Guess
}

export function useCreateGuess() {
  const { data: session } = useSession()
  const owner = session?.user?.id as string
  const queryClient = useQueryClient()

  return useMutation<
    CreateGuessMutation,
    CreateGuessMutationVariables,
    CreateGuessContext
  >(CreateGuessDocument, {
    onMutate: async (variables): Promise<CreateGuessContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.guess.active(owner),
      })

      // Snapshot the previous value
      const previousActiveGuess = queryClient.getQueryData<Guess | null>(
        queryKeys.guess.active(owner)
      )

      // Optimistically set active guess
      const optimisticGuess: Guess = {
        __typename: 'Guess',
        id: `temp-${Date.now()}`,
        owner,
        direction: variables.input.direction,
        settleAt: variables.input.settleAt,
        status: GuessStatus.Pending,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startPriceSnapshotId: null,
        endPriceSnapshotId: null,
        startPrice: null,
        endPrice: null,
        result: null,
        outcome: null,
      }
      queryClient.setQueryData(queryKeys.guess.active(owner), optimisticGuess)

      return { previousActiveGuess, optimisticGuess }
    },
    onSuccess: (data) => {
      if (!owner) return

      // Replace optimistic guess with real one from server
      queryClient.setQueryData(queryKeys.guess.active(owner), data.createGuess)
    },
    onError: (_err, _variables, context) => {
      if (!owner || !context) return

      // Rollback optimistic update
      queryClient.setQueryData(
        queryKeys.guess.active(owner),
        context.previousActiveGuess ?? null
      )
    },
  })
}

// ---------------------------------------------------------------------------
// useGuessHistory - Infinite query for settled guesses
// ---------------------------------------------------------------------------

export function useGuessHistory() {
  const { data: session } = useSession()
  const owner = session?.user?.id

  return useInfiniteQuery({
    queryKey: owner ? queryKeys.guess.history(owner) : ['guess', 'history'],
    queryFn: async ({ pageParam }) => {
      if (!owner) {
        throw new Error('User not authenticated')
      }

      return fetchGraphQLClient(GuessesByOwnerDocument, {
        owner,
        sortDirection: ModelSortDirection.Desc,
        limit: 20,
        nextToken: pageParam as string | undefined,
        filter: { status: { ne: GuessStatus.Pending } }, // Exclude active guess
      })
    },
    getNextPageParam: (lastPage) =>
      lastPage.guessesByOwner?.nextToken ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!owner,
    staleTime: 60_000, // 1 minute
  })
}

// ---------------------------------------------------------------------------
// useGuessSettlementStream - SSE hook for real-time settlement updates
// ---------------------------------------------------------------------------

interface UseGuessSettlementStreamOptions {
  activeGuess: Guess | null
  onSettled: (guess: Guess) => void
}

export function useGuessSettlementStream({
  activeGuess,
  onSettled,
}: UseGuessSettlementStreamOptions) {
  // avoid connecting to the stream on optimistic update
  const shouldConnect = !!activeGuess && !activeGuess.id.startsWith('temp-')

  useEffect(() => {
    if (!shouldConnect) return

    console.log('[SSE] Connecting to guess settlement stream')
    const source = new EventSource('/api/guess/stream')

    function handleSettled(event: MessageEvent) {
      try {
        const guess = JSON.parse(event.data) as Guess
        console.log('[SSE] Received settled event:', guess.id)
        onSettled(guess)
      } catch (error) {
        console.error('[SSE] Failed to parse settled event:', error)
      }
    }

    source.addEventListener('settled', handleSettled)

    source.onerror = (error) => {
      console.error('[SSE] Guess stream error:', error)
      // EventSource will automatically reconnect on error
    }

    return () => {
      console.log('[SSE] Disconnecting from guess settlement stream')
      source.removeEventListener('settled', handleSettled)
      source.close()
    }
  }, [shouldConnect, onSettled])
}

// ---------------------------------------------------------------------------
// useGuessSettlementHandler - Combines SSE stream with optimistic updates
// ---------------------------------------------------------------------------

export function useGuessSettlementHandler(activeGuess: Guess | null) {
  const { data: session } = useSession()
  const owner = session?.user?.id
  const queryClient = useQueryClient()

  const handleSettled = useCallback(
    (settledGuess: Guess) => {
      if (!owner) return

      console.log('[Guess] Handling settlement:', settledGuess.id)

      // 1. Clear active guess
      queryClient.setQueryData(queryKeys.guess.active(owner), null)

      // 2. Prepend to history (optimistic insert)
      queryClient.setQueryData<InfiniteData<GuessesByOwnerQuery> | undefined>(
        queryKeys.guess.history(owner),
        (old) => {
          if (!old) return old

          const firstPage = old.pages[0]
          if (!firstPage) return old

          return {
            ...old,
            pages: [
              {
                ...firstPage,
                guessesByOwner: {
                  ...firstPage.guessesByOwner,
                  items: [
                    settledGuess,
                    ...(firstPage.guessesByOwner?.items ?? []),
                  ],
                },
              },
              ...old.pages.slice(1),
            ],
          }
        }
      )

      // 3. Invalidate user score to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.userState.all })
    },
    [queryClient, owner]
  )

  useGuessSettlementStream({ activeGuess, onSettled: handleSettled })
}
