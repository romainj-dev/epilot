'use client'

import { ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/Card'
import { Badge } from '@/components/ui/badge/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table/Table'
import {
  type Guess,
  GuessDirection,
  GuessOutcome,
  GuessStatus,
} from '@/graphql/generated/graphql'
import styles from './GuessHistory.module.scss'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(p: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p)
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPointsDelta(outcome: GuessOutcome) {
  return outcome === GuessOutcome.Win ? 1 : -1
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DirectionBadgeProps {
  direction: GuessDirection
  upLabel: string
  downLabel: string
}

function DirectionBadge({
  direction,
  upLabel,
  downLabel,
}: DirectionBadgeProps) {
  const isUp = direction === GuessDirection.Up

  return (
    <Badge
      variant="outline"
      className={`${styles.directionBadge} ${
        isUp ? styles.directionUp : styles.directionDown
      }`}
    >
      {isUp ? (
        <ArrowUp className={styles.badgeIcon} />
      ) : (
        <ArrowDown className={styles.badgeIcon} />
      )}
      {isUp ? upLabel : downLabel}
    </Badge>
  )
}

interface MobileHistoryProps {
  history: Guess[]
  upLabel: string
  downLabel: string
}

function MobileHistory({ history, upLabel, downLabel }: MobileHistoryProps) {
  return (
    <div className={styles.mobileView}>
      {history.map((guess) => {
        // Only show settled guesses with outcome
        if (!guess.outcome) return null

        const pointsDelta = getPointsDelta(guess.outcome)
        const isWin = guess.outcome === GuessOutcome.Win

        return (
          <div
            key={guess.id}
            className={`${styles.mobileCard} ${
              isWin ? styles.mobileCardWin : styles.mobileCardLoss
            }`}
          >
            <div className={styles.mobileCardHeader}>
              <div className={styles.mobileCardLeft}>
                <DirectionBadge
                  direction={guess.direction}
                  upLabel={upLabel}
                  downLabel={downLabel}
                />
                <span className={styles.timestamp}>
                  {formatTimestamp(guess.updatedAt)}
                </span>
              </div>

              <div className={styles.mobileCardResult}>
                {isWin ? (
                  <CheckCircle2 className={styles.resultIconWin} />
                ) : (
                  <XCircle className={styles.resultIconLoss} />
                )}
                <span className={isWin ? styles.pointsWin : styles.pointsLoss}>
                  {pointsDelta > 0 ? '+' : ''}
                  {pointsDelta}
                </span>
              </div>
            </div>

            <div className={styles.mobileCardPrices}>
              <span>
                {guess.startPrice ? formatPrice(guess.startPrice) : '—'} →{' '}
                {guess.endPrice ? formatPrice(guess.endPrice) : '—'}
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
  upLabel: string
  downLabel: string
  tResultWin: string
  tResultLoss: string
  headers: {
    direction: string
    entry: string
    resolved: string
    result: string
    points: string
    time: string
  }
}

function DesktopHistory({
  history,
  upLabel,
  downLabel,
  tResultWin,
  tResultLoss,
  headers,
}: DesktopHistoryProps) {
  return (
    <div className={styles.desktopView}>
      <Table>
        <TableHeader>
          <TableRow className={styles.tableHeader}>
            <TableHead className="w-20">{headers.direction}</TableHead>
            <TableHead>{headers.entry}</TableHead>
            <TableHead>{headers.resolved}</TableHead>
            <TableHead>{headers.result}</TableHead>
            <TableHead className="text-right">{headers.points}</TableHead>
            <TableHead className="text-right">{headers.time}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {history.map((guess) => {
            // Only show settled guesses with outcome
            if (!guess.outcome) return null

            const pointsDelta = getPointsDelta(guess.outcome)
            const isWin = guess.outcome === GuessOutcome.Win

            return (
              <TableRow key={guess.id} className={styles.tableRow}>
                <TableCell>
                  <DirectionBadge
                    direction={guess.direction}
                    upLabel={upLabel}
                    downLabel={downLabel}
                  />
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {guess.startPrice ? formatPrice(guess.startPrice) : '—'}
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {guess.endPrice ? formatPrice(guess.endPrice) : '—'}
                </TableCell>

                <TableCell>
                  <div className={styles.resultCell}>
                    {isWin ? (
                      <>
                        <CheckCircle2 className={styles.resultIconWin} />
                        <span className={styles.resultTextWin}>
                          {tResultWin}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className={styles.resultIconLoss} />
                        <span className={styles.resultTextLoss}>
                          {tResultLoss}
                        </span>
                      </>
                    )}
                  </div>
                </TableCell>

                <TableCell className={styles.pointsCell}>
                  <span
                    className={isWin ? styles.pointsWin : styles.pointsLoss}
                  >
                    {pointsDelta > 0 ? '+' : ''}
                    {pointsDelta}
                  </span>
                </TableCell>

                <TableCell className={styles.timestampCell}>
                  {formatTimestamp(guess.updatedAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

interface EmptyStateCardProps {
  title: string
  emptyText: string
}

function EmptyStateCard({ title, emptyText }: EmptyStateCardProps) {
  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.cardTitle}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={styles.empty}>{emptyText}</p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Hook: useGuessHistory (mocked for now)
// ---------------------------------------------------------------------------

interface UseGuessHistoryReturn {
  history: Guess[]
  isLoading: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  isFetchingNextPage: boolean
}

/**
 * Hook that fetches guess history.
 * Currently mocked - will be connected to real API with infinite scroll later.
 */
function useGuessHistory(): UseGuessHistoryReturn {
  // Mock data for demonstration
  const mockHistory: Guess[] = [
    {
      __typename: 'Guess',
      id: 'mock-1',
      owner: 'mock-owner',
      createdAt: new Date(Date.now() - 120000).toISOString(),
      updatedAt: new Date(Date.now() - 60000).toISOString(),
      settleAt: new Date(Date.now() - 60000).toISOString(),
      direction: GuessDirection.Up,
      status: GuessStatus.Settled,
      startPriceSnapshotId: 'snapshot-1',
      endPriceSnapshotId: 'snapshot-2',
      startPrice: 98500,
      endPrice: 99100,
      result: GuessDirection.Up,
      outcome: GuessOutcome.Win,
    },
    {
      __typename: 'Guess',
      id: 'mock-2',
      owner: 'mock-owner',
      createdAt: new Date(Date.now() - 240000).toISOString(),
      updatedAt: new Date(Date.now() - 180000).toISOString(),
      settleAt: new Date(Date.now() - 180000).toISOString(),
      direction: GuessDirection.Down,
      status: GuessStatus.Settled,
      startPriceSnapshotId: 'snapshot-3',
      endPriceSnapshotId: 'snapshot-4',
      startPrice: 99200,
      endPrice: 99400,
      result: GuessDirection.Up,
      outcome: GuessOutcome.Loss,
    },
    {
      __typename: 'Guess',
      id: 'mock-3',
      owner: 'mock-owner',
      createdAt: new Date(Date.now() - 360000).toISOString(),
      updatedAt: new Date(Date.now() - 300000).toISOString(),
      settleAt: new Date(Date.now() - 300000).toISOString(),
      direction: GuessDirection.Up,
      status: GuessStatus.Settled,
      startPriceSnapshotId: 'snapshot-5',
      endPriceSnapshotId: 'snapshot-6',
      startPrice: 98000,
      endPrice: 98800,
      result: GuessDirection.Up,
      outcome: GuessOutcome.Win,
    },
  ]

  return {
    history: mockHistory,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: () => {},
    isFetchingNextPage: false,
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GuessHistory() {
  const t = useTranslations('dashboardGuessHistory')

  const { history } = useGuessHistory()

  // Filter out any pending guesses (they should appear in GuessAction, not here)
  const settledHistory = history.filter(
    (guess) => guess.status === GuessStatus.Settled && guess.outcome !== null
  )

  if (settledHistory.length === 0) {
    return <EmptyStateCard title={t('title')} emptyText={t('empty')} />
  }

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle className={styles.cardTitle}>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile view - cards */}
        <MobileHistory
          history={settledHistory}
          upLabel={t('direction.up')}
          downLabel={t('direction.down')}
        />

        {/* Desktop view - table */}
        <DesktopHistory
          history={settledHistory}
          upLabel={t('direction.up')}
          downLabel={t('direction.down')}
          tResultWin={t('result.win')}
          tResultLoss={t('result.loss')}
          headers={{
            direction: t('table.direction'),
            entry: t('table.entry'),
            resolved: t('table.resolved'),
            result: t('table.result'),
            points: t('table.points'),
            time: t('table.time'),
          }}
        />
      </CardContent>
    </Card>
  )
}
