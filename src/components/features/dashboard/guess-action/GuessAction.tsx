'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUp, ArrowDown } from 'lucide-react'

import { Button } from '@/components/ui/button/Button'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import {
  type CreateGuessInput,
  GuessDirection,
  GuessStatus,
} from '@/graphql/generated/graphql'
import {
  useActiveGuess,
  useCreateGuess,
} from '@/components/features/dashboard/hooks/useGuessHooks'
import styles from './GuessAction.module.scss'
import { ActiveGuess } from './active-guess/ActiveGuess'
import { GUESS_DURATION_MS } from '@/utils/guess'

interface GuessButtonsProps {
  hasActiveGuess: boolean
}

function GuessButtons({ hasActiveGuess }: GuessButtonsProps) {
  const t = useTranslations('dashboardGuessAction')

  const { snapshot } = usePriceSnapshot()
  const currentPrice = snapshot?.priceUsd ?? null

  const { mutate: createGuess, isPending: isPendingCreate } = useCreateGuess()

  // User can guess when there's
  // - no active guess
  // - not currently creating
  // - a first price snapshot received
  const canGuess = !hasActiveGuess && !isPendingCreate && !!currentPrice

  const handleGuess = useCallback(
    (direction: GuessDirection) => {
      if (!canGuess) return

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
    <div className={styles.buttons}>
      <Button
        size="lg"
        disabled={!canGuess}
        onClick={() => handleGuess(GuessDirection.Up)}
        className={styles.upButton}
        data-testid="guess-up"
      >
        <ArrowUp className={styles.buttonIcon} />
        {t('buttons.up')}
      </Button>

      <Button
        size="lg"
        disabled={!canGuess}
        onClick={() => handleGuess(GuessDirection.Down)}
        className={styles.downButton}
        data-testid="guess-down"
      >
        <ArrowDown className={styles.buttonIcon} />
        {t('buttons.down')}
      </Button>
    </div>
  )
}

export function GuessAction() {
  const t = useTranslations('dashboardGuessAction')
  const { data: activeGuess } = useActiveGuess()

  return (
    <div className={styles.wrapper}>
      <GuessButtons hasActiveGuess={!!activeGuess} />

      {activeGuess ? (
        <ActiveGuess guess={activeGuess} />
      ) : (
        <p className={styles.hint}>{t('idleHint')}</p>
      )}
    </div>
  )
}
