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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUESS_DURATION_MS = 60_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GuessActionStatus = 'idle' | 'waiting_time' | 'waiting_price'

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
    second: '2-digit',
  })
}

function getStatusText(
  t: ReturnType<typeof useTranslations>,
  status: GuessActionStatus
) {
  if (status === 'waiting_time') return t('status.waitingTime')
  if (status === 'waiting_price') return t('status.waitingPrice')
  return t('status.idle')
}

function computeTimeRemaining(settleAt: string): number {
  const target = new Date(settleAt).getTime()
  const now = Date.now()
  return Math.max(0, target - now)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface GuessButtonsProps {
  canGuess: boolean
  currentPrice: number | null
  onGuess: (direction: GuessDirection) => void
  upLabel: string
  downLabel: string
}

function GuessButtons({
  canGuess,
  currentPrice,
  onGuess,
  upLabel,
  downLabel,
}: GuessButtonsProps) {
  return (
    <div className={styles.buttons}>
      <Button
        size="lg"
        disabled={!canGuess || currentPrice === null}
        onClick={() => onGuess(GuessDirection.Up)}
        className={styles.upButton}
      >
        <ArrowUp className={styles.buttonIcon} />
        {upLabel}
      </Button>

      <Button
        size="lg"
        disabled={!canGuess || currentPrice === null}
        onClick={() => onGuess(GuessDirection.Down)}
        className={styles.downButton}
      >
        <ArrowDown className={styles.buttonIcon} />
        {downLabel}
      </Button>
    </div>
  )
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

interface ActivePredictionCardProps {
  activeGuess: Guess
  status: GuessActionStatus
  timeRemaining: number
  provisionalStartPrice: number | null
  statusText: string
  countdownText: string
  title: string
  upLabel: string
  downLabel: string
  entryPriceLabel: string
  placedAtLabel: string
}

function ActivePredictionCard({
  activeGuess,
  status,
  timeRemaining,
  provisionalStartPrice,
  statusText,
  countdownText,
  title,
  upLabel,
  downLabel,
  entryPriceLabel,
  placedAtLabel,
}: ActivePredictionCardProps) {
  // Use the resolved startPrice if available, otherwise show provisional
  const displayPrice = activeGuess.startPrice ?? provisionalStartPrice

  return (
    <Card className={styles.activeCard}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>
          <span className={styles.titleContent}>
            {status === 'waiting_time' ? (
              <Clock className={styles.waitingIcon} />
            ) : (
              <Loader2 className={styles.resolvingIcon} />
            )}
            {title}
          </span>

          <DirectionBadge
            direction={activeGuess.direction}
            upLabel={upLabel}
            downLabel={downLabel}
          />
        </CardTitle>
      </CardHeader>

      <CardContent className={styles.cardContent}>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>
              {entryPriceLabel}
              {/* Show ~ to indicate provisional price */}
              {!activeGuess.startPrice && provisionalStartPrice && ' ~'}
            </p>
            <p className={styles.infoValue}>
              {displayPrice ? formatPrice(displayPrice) : '—'}
            </p>
          </div>
          <div>
            <p className={styles.infoLabel}>{placedAtLabel}</p>
            <p className={styles.infoValue}>
              {formatTimestamp(activeGuess.createdAt)}
            </p>
          </div>
        </div>

        {/* Countdown / Status */}
        <div className={styles.statusBox}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>{statusText}</span>
            {status === 'waiting_time' && (
              <span className={styles.countdown}>{countdownText}</span>
            )}
          </div>

          {/* Progress bar for countdown */}
          {status === 'waiting_time' && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${((GUESS_DURATION_MS - timeRemaining) / GUESS_DURATION_MS) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface IdleHintProps {
  text: string
}

function IdleHint({ text }: IdleHintProps) {
  return <p className={styles.hint}>{text}</p>
}

// ---------------------------------------------------------------------------
// Hook: useGuessState
// ---------------------------------------------------------------------------

interface UseGuessStateReturn {
  activeGuess: Guess | null
  isCreating: boolean
  createGuess: (direction: GuessDirection) => void
}

/**
 * Hook that manages guess state using real API/SSE
 */
function useGuessState(): UseGuessStateReturn {
  const { data: activeGuess, isLoading } = useActiveGuess()
  const createGuessMutation = useCreateGuess()

  // Set up real-time settlement handler
  useGuessSettlementHandler(activeGuess ?? null)

  const createGuess = useCallback(
    (direction: GuessDirection) => {
      // Compute settlement time (60 seconds from now)
      const settleAt = new Date(Date.now() + GUESS_DURATION_MS).toISOString()

      // Call mutation with input
      const input: CreateGuessInput = {
        direction,
        settleAt,
        status: GuessStatus.Pending,
      }

      createGuessMutation.mutate({ input })
    },
    [createGuessMutation]
  )

  // Extract data property which is the actual Guess or null
  const activeGuessData = activeGuess ?? null

  return {
    activeGuess: activeGuessData,
    isCreating: createGuessMutation.isPending || isLoading,
    createGuess,
  }
}

// ---------------------------------------------------------------------------
// Hook: useCountdown
// ---------------------------------------------------------------------------

function useCountdown(settleAt: string | null) {
  // Force re-render at regular intervals to update countdown
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!settleAt) return

    // Update every 100ms for smooth progress bar
    const interval = setInterval(() => {
      const remaining = computeTimeRemaining(settleAt)
      forceUpdate((n) => n + 1)

      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [settleAt])

  // Compute time remaining on every render (driven by forceUpdate)
  return settleAt ? computeTimeRemaining(settleAt) : 0
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function GuessAction() {
  const t = useTranslations('dashboardGuessAction')
  const { snapshot } = usePriceSnapshot()

  const { activeGuess, isCreating, createGuess } = useGuessState()

  const timeRemaining = useCountdown(activeGuess?.settleAt ?? null)

  // Derive status from state
  const status: GuessActionStatus = useMemo(() => {
    if (!activeGuess) return 'idle'
    if (timeRemaining > 0) return 'waiting_time'
    return 'waiting_price'
  }, [activeGuess, timeRemaining])

  // User can guess when there's no active guess and not currently creating
  const canGuess = !activeGuess && !isCreating

  // Current price from SSE stream
  const currentPrice = snapshot?.priceUsd ?? null

  const handleGuess = useCallback(
    (direction: GuessDirection) => {
      if (!canGuess) return
      createGuess(direction)
    },
    [canGuess, createGuess]
  )

  const statusText = getStatusText(t, status)
  const seconds = Math.ceil(timeRemaining / 1000)
  const countdownText = t('countdown', { seconds })

  return (
    <div className={styles.wrapper}>
      {/* Guess buttons */}
      <GuessButtons
        canGuess={canGuess}
        currentPrice={currentPrice}
        onGuess={handleGuess}
        upLabel={t('buttons.up')}
        downLabel={t('buttons.down')}
      />

      {/* Active guess status card */}
      {activeGuess && (
        <ActivePredictionCard
          activeGuess={activeGuess}
          status={status}
          timeRemaining={timeRemaining}
          provisionalStartPrice={currentPrice}
          statusText={statusText}
          countdownText={countdownText}
          title={t('active.title')}
          upLabel={t('buttons.up')}
          downLabel={t('buttons.down')}
          entryPriceLabel={t('active.entryPriceLabel')}
          placedAtLabel={t('active.placedAtLabel')}
        />
      )}

      {/* Idle state hint */}
      {!activeGuess && <IdleHint text={t('idleHint')} />}
    </div>
  )
}
