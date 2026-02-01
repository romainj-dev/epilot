'use client'

import { ArrowUp, ArrowDown, CheckCircle2, XCircle, Circle } from 'lucide-react'
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
import { Button } from '@/components/ui/button/Button'
import {
  type Guess,
  GuessDirection,
  GuessOutcome,
  GuessStatus,
} from '@/graphql/generated/graphql'
import { useGuessHistory } from './useGuessHooks'
import styles from './GuessHistory.module.scss'
import { cn } from '@/lib/utils'

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
  switch (outcome) {
    case GuessOutcome.Win:
      return 1
    case GuessOutcome.Loss:
      return -1
    case GuessOutcome.Draw:
      return 0
  }
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

function getResultColor(outcome: GuessOutcome) {
  switch (outcome) {
    case GuessOutcome.Win:
      return styles.colorWin
    case GuessOutcome.Loss:
      return styles.colorLoss
    case GuessOutcome.Draw:
      return styles.colorDraw
  }
}

interface PointsProps {
  outcome: GuessOutcome
}
function Points({ outcome }: PointsProps) {
  const pointsDelta = getPointsDelta(outcome)
  const colorClassName = getResultColor(outcome)

  return (
    <span className={cn(styles.points, colorClassName)}>
      {pointsDelta === 0 ? '' : pointsDelta > 0 ? '+' : ''}
      {pointsDelta}
    </span>
  )
}

interface ResultIconProps {
  outcome: GuessOutcome
  colorClassName: string
}

function ResultIcon({ outcome, colorClassName }: ResultIconProps) {
  switch (outcome) {
    case GuessOutcome.Win:
      return <CheckCircle2 className={cn(styles.resultIcon, colorClassName)} />
    case GuessOutcome.Loss:
      return <XCircle className={cn(styles.resultIcon, colorClassName)} />
    case GuessOutcome.Draw:
    default:
      return <Circle className={cn(styles.resultIcon, colorClassName)} />
  }
}

interface ResultCellProps {
  outcome: GuessOutcome
}

function ResultCell({ outcome }: ResultCellProps) {
  const t = useTranslations('dashboardGuessHistory')

  function getResultText(outcome: GuessOutcome) {
    switch (outcome) {
      case GuessOutcome.Win:
        return t('result.win')
      case GuessOutcome.Loss:
        return t('result.loss')
      case GuessOutcome.Draw:
      default:
        return t('result.draw')
    }
  }

  const colorClassName = getResultColor(outcome)
  const text = getResultText(outcome)

  return (
    <div className={styles.resultCell}>
      {<ResultIcon outcome={outcome} colorClassName={colorClassName} />}
      <span className={cn(styles.points, colorClassName)}>{text}</span>
    </div>
  )
}

interface MobileHistoryProps {
  history: Guess[]
  upLabel: string
  downLabel: string
}

function MobileHistory({ history, upLabel, downLabel }: MobileHistoryProps) {
  return (
    <div className={styles.mobileView} data-testid="guess-history-mobile">
      {history.map((guess) => {
        // Only show settled guesses with outcome
        if (!guess.outcome) return null

        function getCardColorClassName(outcome: GuessOutcome) {
          switch (outcome) {
            case GuessOutcome.Win:
              return styles.mobileCardWin
            case GuessOutcome.Loss:
              return styles.mobileCardLoss
            case GuessOutcome.Draw:
              return styles.mobileCardDraw
          }
        }
        return (
          <div
            key={guess.id}
            className={`${styles.mobileCard} ${getCardColorClassName(
              guess.outcome
            )}`}
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
                <ResultIcon
                  outcome={guess.outcome}
                  colorClassName={getResultColor(guess.outcome)}
                />
                <Points outcome={guess.outcome} />
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
  headers,
}: DesktopHistoryProps) {
  return (
    <div className={styles.desktopView} data-testid="guess-history-desktop">
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
                  <ResultCell outcome={guess.outcome} />
                </TableCell>

                <TableCell className={styles.pointsCell}>
                  <Points outcome={guess.outcome} />
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
// Main Component
// ---------------------------------------------------------------------------

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
    (guess) => guess.status === GuessStatus.Settled && guess.outcome !== null
  )

  if (isLoading) {
    return (
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.cardTitle}>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.empty}>{t('loading')}</p>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.cardTitle}>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.empty}>{t('error')}</p>
        </CardContent>
      </Card>
    )
  }

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
          headers={{
            direction: t('table.direction'),
            entry: t('table.entry'),
            resolved: t('table.resolved'),
            result: t('table.result'),
            points: t('table.points'),
            time: t('table.time'),
          }}
        />

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
      </CardContent>
    </Card>
  )
}
