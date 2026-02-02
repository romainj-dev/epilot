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
import { useGuessSettlementHandler } from '@/components/features/dashboard/hooks/useGuessHooks'
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
  timeRemaining: number
}

function Countdown({ timeRemaining }: CountdownProps) {
  const t = useTranslations('dashboardGuessAction')

  const seconds = Math.ceil(timeRemaining / 1000)
  const countdownText = t('countdown', { seconds })

  return (
    <span className={styles.countdown} data-testid="guess-countdown">
      {countdownText}
    </span>
  )
}

interface ProgressBarProps {
  timeRemaining: number
}

function ProgressBar({ timeRemaining }: ProgressBarProps) {
  const progressPercent =
    ((GUESS_DURATION_MS - timeRemaining) / GUESS_DURATION_MS) * 100

  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        style={{
          width: `${Math.min(100, Math.max(0, progressPercent))}%`,
        }}
      />
    </div>
  )
}

interface StatusProps {
  isWaitingTime: boolean
  timeRemaining: number
}

function Status({ isWaitingTime, timeRemaining }: StatusProps) {
  const t = useTranslations('dashboardGuessAction')

  return (
    <div className={styles.statusBox}>
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>
          {isWaitingTime ? t('status.waitingTime') : t('status.waitingPrice')}
        </span>
        {isWaitingTime && <Countdown timeRemaining={timeRemaining} />}
      </div>

      {/* Progress bar for countdown */}
      {isWaitingTime && <ProgressBar timeRemaining={timeRemaining} />}
    </div>
  )
}

interface ActiveGuessProps {
  guess: Guess
}

export function ActiveGuess({ guess }: ActiveGuessProps) {
  const t = useTranslations('dashboardGuessAction')

  // Set up SSE stream for guess settlement
  useGuessSettlementHandler(guess)

  const timeRemaining = useCountdown({ guess })
  const isWaitingTime = timeRemaining > 0

  const { startPrice, createdAt, direction } = guess

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
        <Status isWaitingTime={isWaitingTime} timeRemaining={timeRemaining} />
      </CardContent>
    </Card>
  )
}
