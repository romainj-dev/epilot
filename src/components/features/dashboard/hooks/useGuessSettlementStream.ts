/**
 * Guess settlement stream management hooks
 *
 * Integrates optimistic updates and SSE streams for responsive UX.
 */
import { useEffect, useCallback } from 'react'
import {
  type Guess,
  GuessStatus,
  GuessesByOwnerQuery,
} from '@/graphql/generated/graphql'
import { useSession } from '@/hooks/use-session'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import { useQueryClient, type InfiniteData } from '@/hooks/requests'
import { wrapGuessAsQueryData } from './useGuessHooks'
import { GUESS_STREAM_PREOPEN_MS } from '@/utils/guess'

type UseGuessSettlementHandlerParams = {
  guess: Guess
}
/**
 * Orchestrates guess settlement handling
 *
 * Combines SSE stream with cache updates, toast notifications, and score invalidation.
 * This is the integration layer between real-time events and React Query cache.
 */
function useGuessSettlementHandler() {
  const { data: session } = useSession()
  const owner = session?.user?.id as string
  const queryClient = useQueryClient()

  const t = useTranslations('dashboardGuessSettlement')
  const { toast } = useToast()
  const errorDescription = t('error.failed')

  const onSettled = useCallback(
    ({ guess }: UseGuessSettlementHandlerParams) => {
      console.log('[Guess] Handling settlement:', guess.id)

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
                  items: [guess, ...(firstPage.guessesByOwner?.items ?? [])],
                },
              },
              ...old.pages.slice(1),
            ],
          }
        }
      )

      // 3. Show toast for failed guesses
      if (guess.status === GuessStatus.Failed) {
        toast({
          variant: 'secondary',
          description: errorDescription,
        })
      }

      // 4. Invalidate user score to refetch (only for settled guesses)
      if (guess.status === GuessStatus.Settled) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.userState.get(owner),
        })
      }
    },
    [queryClient, owner, toast, errorDescription]
  )

  return { onSettled }
}

type UseShouldConnectParams = {
  secondsRemaining: number | null
}
function useShouldConnect({ secondsRemaining }: UseShouldConnectParams) {
  // Convert 2000ms buffer to seconds (2s) for comparison
  const bufferSeconds = Math.ceil(GUESS_STREAM_PREOPEN_MS / 1000)
  const shouldConnect =
    secondsRemaining !== null ? secondsRemaining <= bufferSeconds : false
  return { shouldConnect }
}

type UseGuessSettlementStreamOptions = {
  guessId: string
  secondsRemaining: number | null
}

/**
 * Connects to SSE stream for real-time guess settlement notifications
 *
 * Opens the stream 2s before settlement to ensure we catch the AppSync update.
 * Only connects for server-confirmed guesses (not optimistic temp- IDs).
 *
 * @todo handle edge case when mounting when guess is active === appsync update received
 */
export function useGuessSettlementStream({
  guessId,
  secondsRemaining,
}: UseGuessSettlementStreamOptions) {
  const { onSettled } = useGuessSettlementHandler()
  // Avoid connecting before buffer window
  const { shouldConnect } = useShouldConnect({ secondsRemaining })

  useEffect(() => {
    if (!shouldConnect) return

    console.log('[SSE] Connecting to guess settlement stream')
    const source = new EventSource('/api/guess/stream')

    function handleSettled(event: MessageEvent) {
      try {
        const guess = JSON.parse(event.data) as Guess
        console.log('[SSE] Received settled event:', guess.id)
        if (guess.id === guessId) {
          onSettled({ guess })
        } else {
          console.warn(
            '[SSE] Received settled event for wrong guess:',
            guess.id
          )
        }
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
  }, [shouldConnect, onSettled, guessId])
}
