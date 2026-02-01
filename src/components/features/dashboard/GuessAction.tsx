'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUp, ArrowDown, Clock, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button/Button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/Card'
import { Badge } from '@/components/ui/badge/Badge'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import {
  type Guess,
  type CreateGuessInput,
  GuessDirection,
  GuessStatus,
} from '@/graphql/generated/graphql'
import {
  useActiveGuess,
  useCreateGuess,
  useGuessSettlementHandler,
} from './useGuessHooks'
import styles from './GuessAction.module.scss'

const GUESS_DURATION_MS = 60_000

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
    second: '2-digit',
  })
}

function computeTimeRemaining(settleAt: string): number {
  const target = new Date(settleAt).getTime()
  const now = Date.now()
  return Math.max(0, target - now)
}

interface GuessButtonsProps {
  canGuess: boolean
  onGuess: (direction: GuessDirection) => void
  upLabel: string
  downLabel: string
}

function GuessButtons({
  canGuess,
  onGuess,
  upLabel,
  downLabel,
}: GuessButtonsProps) {
  return (
    <div className={styles.buttons}>
      <Button
        size="lg"
        disabled={!canGuess}
        onClick={() => onGuess(GuessDirection.Up)}
        className={styles.upButton}
        data-testid="guess-up"
      >
        <ArrowUp className={styles.buttonIcon} />
        {upLabel}
      </Button>

      <Button
        size="lg"
        disabled={!canGuess}
        onClick={() => onGuess(GuessDirection.Down)}
        className={styles.downButton}
        data-testid="guess-down"
      >
        <ArrowDown className={styles.buttonIcon} />
        {downLabel}
      </Button>
    </div>
  )
}

interface DirectionBadgeProps {
  direction: GuessDirection
}

function DirectionBadge({ direction }: DirectionBadgeProps) {
  const t = useTranslations('dashboardGuessAction')
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
      {isUp ? t('buttons.up') : t('buttons.down')}
    </Badge>
  )
}

interface ActivePredictionCardProps {
  activeGuess: Guess
}

function ActivePredictionCard({ activeGuess }: ActivePredictionCardProps) {
  const t = useTranslations('dashboardGuessAction')

  const timeRemaining = useCountdown(activeGuess)
  const isWaitingTime = timeRemaining > 0

  const seconds = Math.ceil(timeRemaining / 1000)
  const countdownText = t('countdown', { seconds })

  return (
    <Card className={styles.activeCard} data-testid="guess-active">
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>
          <span className={styles.titleContent}>
            {isWaitingTime ? (
              <Clock className={styles.waitingIcon} />
            ) : (
              <Loader2 className={styles.resolvingIcon} />
            )}
            {t('active.title')}
          </span>

          <DirectionBadge direction={activeGuess.direction} />
        </CardTitle>
      </CardHeader>

      <CardContent className={styles.cardContent}>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>{t('active.entryPriceLabel')}</p>
            <p className={styles.infoValue}>
              {activeGuess.startPrice
                ? formatPrice(activeGuess.startPrice)
                : '—'}
            </p>
          </div>
          <div>
            <p className={styles.infoLabel}>{t('active.placedAtLabel')}</p>
            <p className={styles.infoValue}>
              {formatTimestamp(activeGuess.createdAt)}
            </p>
          </div>
        </div>

        {/* Countdown / Status */}
        <div className={styles.statusBox}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>
              {isWaitingTime
                ? t('status.waitingTime')
                : t('status.waitingPrice')}
            </span>
            {isWaitingTime && (
              <span className={styles.countdown} data-testid="guess-countdown">
                {countdownText}
              </span>
            )}
          </div>

          {/* Progress bar for countdown */}
          {isWaitingTime && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(100, Math.max(0, ((GUESS_DURATION_MS - timeRemaining) / GUESS_DURATION_MS) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Hook: useCountdown
// ---------------------------------------------------------------------------

function useCountdown(activeGuess: Guess | null | undefined) {
  // Track time remaining in state
  const [timeRemaining, setTimeRemaining] = useState(0)

  // Memoize settleAt to prevent unnecessary effect reruns
  const settleAt = useMemo(
    () => activeGuess?.settleAt ?? null,
    [activeGuess?.settleAt]
  )

  useEffect(() => {
    if (!settleAt) {
      // No need to set state here, just return
      return
    }

    // Update immediately and then every 100ms for smooth progress bar
    const updateTimeRemaining = () => {
      const remaining = computeTimeRemaining(settleAt)
      setTimeRemaining(remaining)
      return remaining
    }

    // Initial update
    const initial = updateTimeRemaining()

    // Don't set interval if already expired
    if (initial <= 0) {
      return
    }

    const interval = setInterval(() => {
      const remaining = updateTimeRemaining()
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [settleAt])

  return settleAt ? timeRemaining : 0
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GuessAction() {
  const t = useTranslations('dashboardGuessAction')
  const { snapshot } = usePriceSnapshot()
  const { data: activeGuess } = useActiveGuess()
  const { mutate: createGuess, isPending: isPendingCreate } = useCreateGuess()

  // Set up real-time settlement handler
  useGuessSettlementHandler(activeGuess ?? null)

  // Current price from SSE stream
  const currentPrice = snapshot?.priceUsd ?? null

  // User can guess when there's
  // - no active guess
  // - not currently creating
  // - a first price snapshot received
  const canGuess = !activeGuess && !isPendingCreate && !!currentPrice

  const handleGuess = useCallback(
    (direction: GuessDirection) => {
      if (!canGuess || currentPrice === null) return

      // Compute settlement time (60 seconds from now)
      const settleAt = new Date(Date.now() + GUESS_DURATION_MS).toISOString()

      // Call mutation with input, including the current price as startPrice
      const input: CreateGuessInput = {
        direction,
        settleAt,
        status: GuessStatus.Pending,
        startPrice: currentPrice,
      }

      createGuess({ input })
    },
    [canGuess, createGuess, currentPrice]
  )

  return (
    <div className={styles.wrapper}>
      <GuessButtons
        canGuess={canGuess}
        onGuess={handleGuess}
        upLabel={t('buttons.up')}
        downLabel={t('buttons.down')}
      />

      {activeGuess ? (
        <ActivePredictionCard activeGuess={activeGuess} />
      ) : (
        <p className={styles.hint}>{t('idleHint')}</p>
      )}
    </div>
  )
}
