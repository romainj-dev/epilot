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
  GetUserStateDocument,
} from '@/graphql/generated/graphql'
import styles from './page.module.scss'
import { GuessAction } from '@/components/features/dashboard/guess-action/GuessAction'
import { PriceTickerBig } from '@/components/features/price-snapshot/PriceTickerBig'
import { GuessHistory } from '@/components/features/dashboard/guess-history/GuessHistory'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'

export async function generateMetadata() {
  const t = await getTranslations('dashboardPage')

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboardPage')
  const session = await auth()
  const owner = session?.user?.id
  const idToken = session?.cognitoIdToken

  const queryClient = new QueryClient()

  // Prefetch active guess, history, and user state in parallel
  if (owner && idToken) {
    await Promise.all([
      // Prefetch active guess (PENDING status)
      queryClient.prefetchQuery({
        queryKey: queryKeys.guess.active(owner),
        queryFn: () =>
          fetchGraphQL({
            document: GuessesByOwnerDocument,
            variables: {
              owner,
              filter: { status: { eq: GuessStatus.Pending } },
              sortDirection: ModelSortDirection.Desc,
              limit: 1,
            },
            idToken,
          }),
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
      // Prefetch user state
      queryClient.prefetchQuery({
        queryKey: queryKeys.userState.get(owner),
        queryFn: () =>
          fetchGraphQL({
            document: GetUserStateDocument,
            variables: { id: owner },
            idToken,
          }),
      }),
    ])
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className={styles.main}>
        <h1 className={styles.hiddenPageTitle}>{t('heading')}</h1>
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
