'use client'

import { useTranslations } from 'next-intl'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/Table'
import { Button } from '@/components/ui/button/Button'
import { type Guess } from '@/graphql/generated/graphql'
import { useGuessHistory } from '@/components/features/dashboard/hooks/useGuessHooks'
import styles from './GuessHistory.module.scss'
import {
  getFormattedPriceSnapshot,
  getFormattedDateTimeSnapshot,
} from '@/components/features/price-snapshot/utils'
import { GuessDirectionBadge } from '@/components/features/dashboard/commons/GuessDirectionBadge'
import { GuessHistoryPoints } from './commons/GuessHistoryPoints'
import {
  GuessHistoryResult,
  GuessHistoryResultIcon,
} from './commons/GuessHistoryResult'
import { GuessHistoryContainer } from './commons/GuessHistoryContainer'

type FormatPriceParams = {
  priceUsd: Guess['startPrice'] | Guess['endPrice']
}

export function formatPrice({ priceUsd }: FormatPriceParams) {
  return priceUsd ? getFormattedPriceSnapshot({ priceUsd }) : '-'
}

type FormatPriceRangeParams = {
  startPrice: Guess['startPrice']
  endPrice: Guess['endPrice']
}

export function formatPriceRange({
  startPrice,
  endPrice,
}: FormatPriceRangeParams) {
  return `${formatPrice({ priceUsd: startPrice })} → ${formatPrice({ priceUsd: endPrice })}`
}

interface MobileHistoryProps {
  history: Guess[]
}

function MobileHistory({ history }: MobileHistoryProps) {
  return (
    <div className={styles.mobileView} data-testid="guess-history-mobile">
      {history.map((guess) => {
        if (!guess.outcome) return null

        return (
          <div
            key={guess.id}
            className={styles.mobileCard}
            data-outcome={guess.outcome.toLowerCase()}
          >
            <div className={styles.mobileCardHeader}>
              <div className={styles.mobileCardLeft}>
                <GuessDirectionBadge direction={guess.direction} />
                <span className={styles.timestamp}>
                  {getFormattedDateTimeSnapshot({
                    timestamp: guess.updatedAt,
                  })}
                </span>
              </div>

              <div className={styles.mobileCardResult}>
                <GuessHistoryResultIcon outcome={guess.outcome} />
                <GuessHistoryPoints outcome={guess.outcome} />
              </div>
            </div>

            <div className={styles.mobileCardPrices}>
              <span>
                {formatPriceRange({
                  startPrice: guess.startPrice,
                  endPrice: guess.endPrice,
                })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface DesktopHistoryProps {
  history: Guess[]
}

function DesktopHistory({ history }: DesktopHistoryProps) {
  const t = useTranslations('dashboardGuessHistory')
  return (
    <div className={styles.desktopView} data-testid="guess-history-desktop">
      <Table>
        <TableHeader>
          <TableRow className={styles.tableHeader}>
            <TableHead>{t('table.direction')}</TableHead>
            <TableHead>{t('table.entry')}</TableHead>
            <TableHead>{t('table.resolved')}</TableHead>
            <TableHead>{t('table.result')}</TableHead>
            <TableHead className={styles.tableHeadRight}>
              {t('table.points')}
            </TableHead>
            <TableHead className={styles.tableHeadRight}>
              {t('table.time')}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {history.map((guess) => {
            if (!guess.outcome) return null

            return (
              <TableRow key={guess.id} className={styles.tableRow}>
                <TableCell>
                  <GuessDirectionBadge direction={guess.direction} />
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {formatPrice({ priceUsd: guess.startPrice })}
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {formatPrice({ priceUsd: guess.endPrice })}
                </TableCell>

                <TableCell>
                  <GuessHistoryResult outcome={guess.outcome} />
                </TableCell>

                <TableCell className={styles.pointsCell}>
                  <GuessHistoryPoints outcome={guess.outcome} />
                </TableCell>

                <TableCell className={styles.timestampCell}>
                  {getFormattedDateTimeSnapshot({
                    timestamp: guess.updatedAt,
                  })}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function GuessHistory() {
  const t = useTranslations('dashboardGuessHistory')

  const {
    data: history,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useGuessHistory()

  // Filter out any pending guesses (they should appear in GuessAction, not here)
  const settledHistory = (history ?? []).filter(
    (guess) => guess.outcome !== null
  )

  const isEmpty = settledHistory.length === 0

  return (
    <GuessHistoryContainer>
      {isEmpty ? (
        <p className={styles.empty}>{t('empty')}</p>
      ) : isLoading ? (
        <p className={styles.empty}>{t('loading')}</p>
      ) : isError ? (
        <p className={styles.empty}>{t('error')}</p>
      ) : (
        <>
          {/* Mobile view - cards */}
          <MobileHistory history={settledHistory} />
          {/* Desktop view - table */}
          <DesktopHistory history={settledHistory} />

          {/* Load more button */}
          {hasNextPage && (
            <div className={styles.loadMore}>
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                data-testid="load-more-button"
              >
                {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </GuessHistoryContainer>
  )
}
