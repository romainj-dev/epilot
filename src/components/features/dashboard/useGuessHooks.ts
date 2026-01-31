import { useCallback, useEffect } from 'react'
import { useSession } from '@/hooks/use-session'

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@/hooks/requests'
import {
  CreateGuessDocument,
  GuessesByOwnerDocument,
  type Guess,
  type GuessesByOwnerQuery,
  type GuessesByOwnerQueryVariables,
  type CreateGuessMutation,
  type CreateGuessMutationVariables,
  GuessStatus,
  ModelSortDirection,
} from '@/graphql/generated/graphql'
import { queryKeys } from '@/lib/query-keys'

// ---------------------------------------------------------------------------
// useActiveGuess - Query for the user's current PENDING guess
// ---------------------------------------------------------------------------

export function useActiveGuess() {
  const { data: session } = useSession()
  const owner = session?.user?.id as string

  return useQuery<
    GuessesByOwnerQuery,
    GuessesByOwnerQueryVariables,
    Guess | null
  >(
    GuessesByOwnerDocument,
    {
      owner: owner!,
      filter: { status: { eq: GuessStatus.Pending } },
      sortDirection: ModelSortDirection.Desc,
      limit: 1,
    },
    {
      queryKey: queryKeys.guess.active(owner),
      enabled: !!owner,
      staleTime: Infinity, // Only update via mutation/SSE
      select: (data) => data.guessesByOwner?.items?.[0] ?? null,
    }
  )
}

// ---------------------------------------------------------------------------
// useCreateGuess - Mutation to create a new guess with optimistic updates
// ---------------------------------------------------------------------------

interface CreateGuessContext {
  previousActiveGuess?: GuessesByOwnerQuery
  optimisticGuess: Guess
}

/** Helper to wrap a Guess in the GuessesByOwnerQuery shape for cache storage */
function wrapGuessAsQueryData(guess: Guess | null): GuessesByOwnerQuery {
  return {
    guessesByOwner: {
      __typename: 'ModelGuessConnection',
      items: guess ? [guess] : [],
      nextToken: null,
    },
  }
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

      // Snapshot the previous value (stored as GuessesByOwnerQuery in cache)
      const previousActiveGuess = queryClient.getQueryData<GuessesByOwnerQuery>(
        queryKeys.guess.active(owner)
      )

      // Optimistically set active guess with the startPrice from input
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
        startPrice: variables.input.startPrice ?? null,
        endPrice: null,
        result: null,
        outcome: null,
      }

      // Store in cache as GuessesByOwnerQuery (matches queryFn response shape)
      queryClient.setQueryData(
        queryKeys.guess.active(owner),
        wrapGuessAsQueryData(optimisticGuess)
      )

      return { previousActiveGuess, optimisticGuess }
    },
    onSuccess: (data) => {
      if (!owner) return

      // Replace optimistic guess with real one from server (wrapped in query shape)
      queryClient.setQueryData(
        queryKeys.guess.active(owner),
        wrapGuessAsQueryData(data.createGuess as Guess)
      )
    },
    onError: (_err, _variables, context) => {
      if (!owner || !context) return

      // Rollback optimistic update (restore previous query data shape)
      queryClient.setQueryData(
        queryKeys.guess.active(owner),
        context.previousActiveGuess ?? wrapGuessAsQueryData(null)
      )
    },
  })
}

// ---------------------------------------------------------------------------
// useGuessHistory - Infinite query for settled guesses with flattened data
// ---------------------------------------------------------------------------

export function useGuessHistory() {
  const { data: session } = useSession()
  const owner = session?.user?.id

  return useInfiniteQuery<
    GuessesByOwnerQuery,
    GuessesByOwnerQueryVariables,
    Guess[],
    string | undefined
  >(GuessesByOwnerDocument, {
    queryKey: queryKeys.guess.history(owner ?? 'unknown'),
    getVariables: (pageParam) => ({
      owner: owner!,
      sortDirection: ModelSortDirection.Desc,
      limit: 20,
      nextToken: pageParam,
      filter: { status: { ne: GuessStatus.Pending } }, // Exclude active guess
    }),
    getNextPageParam: (lastPage: GuessesByOwnerQuery) =>
      lastPage.guessesByOwner?.nextToken ?? undefined,
    initialPageParam: undefined,
    enabled: !!owner,
    staleTime: 60_000, // 1 minute
    // Flatten pages into a single array of guesses
    select: (data: InfiniteData<GuessesByOwnerQuery>) =>
      data.pages.flatMap(
        (page: GuessesByOwnerQuery) =>
          page.guessesByOwner?.items?.filter(Boolean) ?? []
      ) as Guess[],
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

      // 1. Clear active guess (store empty query data shape)
      queryClient.setQueryData(
        queryKeys.guess.active(owner),
        wrapGuessAsQueryData(null)
      )

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
      queryClient.invalidateQueries({
        queryKey: queryKeys.userState.get(owner),
      })
    },
    [queryClient, owner]
  )

  useGuessSettlementStream({ activeGuess, onSettled: handleSettled })
}
