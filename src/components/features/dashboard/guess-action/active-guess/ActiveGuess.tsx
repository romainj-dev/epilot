/**
 * ActiveGuess - Displays the user's active prediction with live countdown
 *
 * Shows entry price, timestamp, direction badge, and real-time countdown.
 * Automatically transitions to settlement phase when countdown completes.
 * Connects to SSE stream for settlement notifications.
 */

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/Card'
import { Clock, Loader2 } from 'lucide-react'
import { Guess } from '@/graphql/generated/graphql'
import { GuessDirectionBadge } from '@/components/features/dashboard/commons/GuessDirectionBadge'
import { useTranslations } from 'next-intl'
import {
  getFormattedPriceSnapshot,
  getFormattedDateTimeSnapshot,
} from '@/components/features/price-snapshot/utils'
import { GUESS_DURATION_MS } from '@/utils/guess'
import { useGuessSettlementStream } from '@/components/features/dashboard/hooks/useGuessSettlementStream'
import styles from './ActiveGuess.module.scss'
import { useCountdown } from './hooks/useCountdown'

interface InfoProps {
  label: string
  value: string | null
}

function Info({ label, value }: InfoProps) {
  return value ? (
    <div>
      <p className={styles.infoLabel}>{label}</p>
      <p className={styles.infoValue}>{value}</p>
    </div>
  ) : null
}

interface CountdownProps {
  secondsRemaining: number
}

function Countdown({ secondsRemaining }: CountdownProps) {
  const t = useTranslations('dashboardGuessAction')

  const countdownText = t('countdown', { seconds: secondsRemaining })

  return (
    <span className={styles.countdown} data-testid="guess-countdown">
      {countdownText}
    </span>
  )
}

interface ProgressBarProps {
  createdAt: string
}

function ProgressBar({ createdAt }: ProgressBarProps) {
  // Calculate elapsed time to start animation at correct position
  const [animationParams] = useState(() => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime()
    const remainingMs = Math.max(0, GUESS_DURATION_MS - elapsedMs)
    return { elapsed: elapsedMs, remaining: remainingMs }
  })

  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        style={
          {
            '--duration': `${animationParams.remaining}ms`,
            '--delay': `-${animationParams.elapsed}ms`,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

interface StatusProps {
  isWaitingTime: boolean
  secondsRemaining: number
  createdAt: string
}

function Status({ isWaitingTime, secondsRemaining, createdAt }: StatusProps) {
  const t = useTranslations('dashboardGuessAction')

  return (
    <div className={styles.statusBox}>
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>
          {isWaitingTime ? t('status.waitingTime') : t('status.waitingPrice')}
        </span>
        {isWaitingTime && <Countdown secondsRemaining={secondsRemaining} />}
      </div>

      {isWaitingTime && <ProgressBar createdAt={createdAt} />}
    </div>
  )
}

interface ActiveGuessProps {
  guess: Guess
}

export function ActiveGuess({ guess }: ActiveGuessProps) {
  const t = useTranslations('dashboardGuessAction')
  const { secondsRemaining } = useCountdown({ settleAt: guess.settleAt })
  const isWaitingTime = secondsRemaining !== null ? secondsRemaining > 0 : null

  // Set up SSE stream for guess settlement
  useGuessSettlementStream({ guessId: guess.id, secondsRemaining })

  const { startPrice, settleAt, direction } = guess

  // settleAt is the source of truth - guess.createdAt is the database timestamp
  const createdAt = new Date(
    new Date(settleAt).getTime() - GUESS_DURATION_MS
  ).toISOString()

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

          <GuessDirectionBadge direction={direction} />
        </CardTitle>
      </CardHeader>

      <CardContent className={styles.cardContent}>
        <div className={styles.infoGrid}>
          <Info
            label={t('active.entryPriceLabel')}
            value={getFormattedPriceSnapshot({
              priceUsd: startPrice ?? undefined,
            })}
          />
          <Info
            label={t('active.placedAtLabel')}
            value={getFormattedDateTimeSnapshot({
              timestamp: createdAt,
            })}
          />
        </div>

        {/* Countdown / Status */}
        {isWaitingTime !== null && secondsRemaining !== null ? (
          <Status
            isWaitingTime={isWaitingTime}
            secondsRemaining={secondsRemaining}
            createdAt={createdAt}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
