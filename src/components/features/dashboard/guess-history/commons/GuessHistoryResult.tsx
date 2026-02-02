import { GuessOutcome } from '@/graphql/generated/graphql'
import styles from './GuessHistoryResult.module.scss'
import { CheckCircle2, XCircle, Circle, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

const OUTCOME_ICONS: Record<GuessOutcome, LucideIcon> = {
  [GuessOutcome.Win]: CheckCircle2,
  [GuessOutcome.Loss]: XCircle,
  [GuessOutcome.Draw]: Circle,
} as const

interface GuessHistoryResultIconProps {
  outcome: GuessOutcome
}

export function GuessHistoryResultIcon({
  outcome,
}: GuessHistoryResultIconProps) {
  const Icon = OUTCOME_ICONS[outcome]
  return (
    <Icon className={styles.resultIcon} data-outcome={outcome.toLowerCase()} />
  )
}

interface GuessHistoryResultProps {
  outcome: GuessOutcome
}

export function GuessHistoryResult({ outcome }: GuessHistoryResultProps) {
  const t = useTranslations('dashboardGuessHistory')

  const RESULT_TEXT: Record<GuessOutcome, string> = {
    [GuessOutcome.Win]: t('result.win'),
    [GuessOutcome.Loss]: t('result.loss'),
    [GuessOutcome.Draw]: t('result.draw'),
  }

  return (
    <div className={styles.container}>
      <GuessHistoryResultIcon outcome={outcome} />
      <span className={styles.resultText} data-outcome={outcome.toLowerCase()}>
        {RESULT_TEXT[outcome]}
      </span>
    </div>
  )
}
