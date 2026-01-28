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
import type { Guess } from '@/graphql/generated/graphql'
import styles from './GuessHistory.module.scss'

type GuessDirection = 'up' | 'down'
type GuessOutcome = 'win' | 'loss'

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

function getPredictedDirection(guess: Guess): GuessDirection {
  // Schema: guessPrice is the predicted future price, startPrice is the price at guess time.
  // Treat equal as "up" to keep the existing 2-option UI.
  return guess.guessPrice >= guess.startPrice ? 'up' : 'down'
}

function getResolvedPrice(guess: Guess) {
  // Placeholder: endPrice can be null (pending); keep UI stable by falling back.
  return guess.endPrice ?? guess.startPrice
}

function getOutcome(guess: Guess): GuessOutcome {
  // Placeholder win/loss computation so the UI can render consistently without game logic.
  const predicted = getPredictedDirection(guess)
  const resolvedPrice = getResolvedPrice(guess)
  const wentUp = resolvedPrice >= guess.startPrice
  const predictedUp = predicted === 'up'
  return wentUp === predictedUp ? 'win' : 'loss'
}

function getPointsDelta(outcome: GuessOutcome) {
  // Placeholder scoring to match the existing UI (+/-)
  return outcome === 'win' ? 1 : -1
}

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
  return (
    <Badge
      variant="outline"
      className={`${styles.directionBadge} ${
        direction === 'up' ? styles.directionUp : styles.directionDown
      }`}
    >
      {direction === 'up' ? (
        <ArrowUp className={styles.badgeIcon} />
      ) : (
        <ArrowDown className={styles.badgeIcon} />
      )}
      {direction === 'up' ? upLabel : downLabel}
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
        const direction = getPredictedDirection(guess)
        const outcome = getOutcome(guess)
        const pointsDelta = getPointsDelta(outcome)
        const resolvedPrice = getResolvedPrice(guess)

        return (
          <div
            key={guess.id}
            className={`${styles.mobileCard} ${
              outcome === 'win' ? styles.mobileCardWin : styles.mobileCardLoss
            }`}
          >
            <div className={styles.mobileCardHeader}>
              <div className={styles.mobileCardLeft}>
                <DirectionBadge
                  direction={direction}
                  upLabel={upLabel}
                  downLabel={downLabel}
                />
                <span className={styles.timestamp}>
                  {formatTimestamp(guess.updatedAt)}
                </span>
              </div>

              <div className={styles.mobileCardResult}>
                {outcome === 'win' ? (
                  <CheckCircle2 className={styles.resultIconWin} />
                ) : (
                  <XCircle className={styles.resultIconLoss} />
                )}
                <span
                  className={
                    outcome === 'win' ? styles.pointsWin : styles.pointsLoss
                  }
                >
                  {pointsDelta > 0 ? '+' : ''}
                  {pointsDelta}
                </span>
              </div>
            </div>

            <div className={styles.mobileCardPrices}>
              <span>
                {formatPrice(guess.startPrice)} → {formatPrice(resolvedPrice)}
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
            const direction = getPredictedDirection(guess)
            const outcome = getOutcome(guess)
            const pointsDelta = getPointsDelta(outcome)
            const resolvedPrice = getResolvedPrice(guess)

            return (
              <TableRow key={guess.id} className={styles.tableRow}>
                <TableCell>
                  <DirectionBadge
                    direction={direction}
                    upLabel={upLabel}
                    downLabel={downLabel}
                  />
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {formatPrice(guess.startPrice)}
                </TableCell>

                <TableCell className={styles.priceCell}>
                  {formatPrice(resolvedPrice)}
                </TableCell>

                <TableCell>
                  <div className={styles.resultCell}>
                    {outcome === 'win' ? (
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
                    className={
                      outcome === 'win' ? styles.pointsWin : styles.pointsLoss
                    }
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

export function GuessHistory() {
  const t = useTranslations('dashboardGuessHistory')

  // Placeholders (GuessHistory does not receive props in this project).
  const history: Guess[] = []

  if (history.length === 0) {
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
          history={history}
          upLabel={t('direction.up')}
          downLabel={t('direction.down')}
        />

        {/* Desktop view - table */}
        <DesktopHistory
          history={history}
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
