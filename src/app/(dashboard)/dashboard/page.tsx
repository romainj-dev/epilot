import { getTranslations } from 'next-intl/server'
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'

import { auth } from '@/lib/auth'
import { fetchGraphQL } from '@/lib/requests'
import { queryKeys } from '@/lib/query-keys'
import {
  GuessesByOwnerDocument,
  GuessStatus,
  ModelSortDirection,
} from '@/graphql/generated/graphql'
import styles from './page.module.scss'
import { GuessAction } from '@/components/features/dashboard/GuessAction'
import { PriceTickerBig } from '@/components/features/price-snapshot/PriceTickerBig'
import { GuessHistory } from '@/components/features/dashboard/GuessHistory'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'

export async function generateMetadata() {
  const t = await getTranslations('dashboardPage')

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const owner = session?.user?.id
  const idToken = session?.cognitoIdToken

  const queryClient = new QueryClient()

  // Prefetch active guess and first page of history in parallel
  if (owner && idToken) {
    await Promise.all([
      // Prefetch active guess (PENDING status)
      queryClient.prefetchQuery({
        queryKey: queryKeys.guess.active(owner),
        queryFn: async () => {
          const data = await fetchGraphQL({
            document: GuessesByOwnerDocument,
            variables: {
              owner,
              filter: { status: { eq: GuessStatus.Pending } },
              sortDirection: ModelSortDirection.Desc,
              limit: 1,
            },
            idToken,
          })
          return data.guessesByOwner?.items?.[0] ?? null
        },
      }),
      // Prefetch first page of history (non-PENDING status)
      queryClient.prefetchInfiniteQuery({
        queryKey: queryKeys.guess.history(owner),
        queryFn: async () => {
          return fetchGraphQL({
            document: GuessesByOwnerDocument,
            variables: {
              owner,
              sortDirection: ModelSortDirection.Desc,
              limit: 20,
              filter: { status: { ne: GuessStatus.Pending } },
            },
            idToken,
          })
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) =>
          lastPage.guessesByOwner?.nextToken ?? undefined,
        pages: 1,
      }),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className={styles.main}>
        <ErrorBoundary context="PriceTickerBig" inline>
          <PriceTickerBig />
        </ErrorBoundary>

        <ErrorBoundary context="GuessAction">
          <GuessAction />
        </ErrorBoundary>

        <ErrorBoundary context="GuessHistory">
          <GuessHistory />
        </ErrorBoundary>
      </div>
    </HydrationBoundary>
  )
}
