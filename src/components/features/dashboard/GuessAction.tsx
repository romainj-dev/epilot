'use client'

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
import type { Guess } from '@/graphql/generated/graphql'
import styles from './GuessAction.module.scss'

type GuessDirection = 'up' | 'down'
type GuessActionStatus = 'idle' | 'waiting_time' | 'waiting_price'

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

function getGuessDirection(guess: Guess): GuessDirection {
  // The schema stores a numeric prediction (guessPrice) relative to the startPrice.
  // Equal is treated as "up" to keep the existing UI 2-option behavior.
  return guess.guessPrice >= guess.startPrice ? 'up' : 'down'
}

function getStatusText(
  t: ReturnType<typeof useTranslations>,
  status: GuessActionStatus
) {
  if (status === 'waiting_time') return t('status.waitingTime')
  if (status === 'waiting_price') return t('status.waitingPrice')
  return t('status.idle')
}

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
        onClick={() => onGuess('up')}
        className={styles.upButton}
      >
        <ArrowUp className={styles.buttonIcon} />
        {upLabel}
      </Button>

      <Button
        size="lg"
        disabled={!canGuess || currentPrice === null}
        onClick={() => onGuess('down')}
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

interface ActivePredictionCardProps {
  activeGuess: Guess
  status: GuessActionStatus
  timeRemaining: number
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
  statusText,
  countdownText,
  title,
  upLabel,
  downLabel,
  entryPriceLabel,
  placedAtLabel,
}: ActivePredictionCardProps) {
  const direction = getGuessDirection(activeGuess)

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
            direction={direction}
            upLabel={upLabel}
            downLabel={downLabel}
          />
        </CardTitle>
      </CardHeader>

      <CardContent className={styles.cardContent}>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>{entryPriceLabel}</p>
            <p className={styles.infoValue}>
              {formatPrice(activeGuess.startPrice)}
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
                  width: `${((60000 - timeRemaining) / 60000) * 100}%`,
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

export function GuessAction() {
  const t = useTranslations('dashboardGuessAction')

  const activeGuess: Guess | null = null
  const status: GuessActionStatus = 'idle'
  const canGuess = true
  const timeRemaining = 0
  const currentPrice: number | null = 100000
  const onGuess = (direction: GuessDirection) => {
    void direction
  }

  const statusText = getStatusText(t, status)
  const seconds = Math.ceil(timeRemaining / 1000)
  const countdownText = t('countdown', { seconds })

  return (
    <div className={styles.wrapper}>
      {/* Guess buttons */}
      <GuessButtons
        canGuess={canGuess}
        currentPrice={currentPrice}
        onGuess={onGuess}
        upLabel={t('buttons.up')}
        downLabel={t('buttons.down')}
      />

      {/* Active guess status card */}
      {activeGuess && (
        <ActivePredictionCard
          activeGuess={activeGuess}
          status={status}
          timeRemaining={timeRemaining}
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
