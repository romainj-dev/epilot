/**
 * Guess management hooks for Bitcoin price prediction game
 *
 * Provides data fetching, mutations, and real-time settlement handling for user guesses.
 */

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

/**
 * Fetches the user's current active (PENDING) guess
 *
 * Stale time is infinite because updates come only via mutations or SSE.
 */
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

type CreateGuessContext = {
  previousActiveGuess?: GuessesByOwnerQuery
  optimisticGuess: Guess
}

/**
 * Wraps a Guess in GuessesByOwnerQuery shape for cache storage
 *
 * Required because the cache stores query results, not raw entities.
 */
export function wrapGuessAsQueryData(guess: Guess | null): GuessesByOwnerQuery {
  return {
    guessesByOwner: {
      __typename: 'ModelGuessConnection',
      items: guess ? [guess] : [],
      nextToken: null,
    },
  }
}

/**
 * Creates a new guess with optimistic updates
 *
 * Immediately shows the guess in the UI (optimistic update) and rolls back on error.
 * This prevents UI lag while waiting for the server response.
 */
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

/**
 * Fetches paginated history of settled guesses
 *
 * Returns flattened array across all pages for simplified rendering.
 * Excludes PENDING guesses (shown in GuessAction instead).
 */
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
