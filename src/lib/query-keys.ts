/**
 * Centralized query key factory for TanStack Query.
 *
 * This ensures consistency between:
 * - SSR prefetch
 * - Client-side queries
 * - Optimistic updates
 * - Cache invalidation
 *
 * @example
 * // In hooks
 * queryClient.setQueryData(queryKeys.guess.active(owner), data)
 *
 * @example
 * // In prefetch
 * queryClient.prefetchQuery({
 *   queryKey: queryKeys.guess.active(owner),
 *   queryFn: ...
 * })
 */
export const queryKeys = {
  guess: {
    all: ['guess'] as const,
    active: (owner: string) => ['guess', 'active', owner] as const,
    history: (owner: string) => ['guess', 'history', owner] as const,
  },
  userState: {
    all: ['userState'] as const,
    get: (id: string) => ['userState', 'get', id] as const,
  },
}
