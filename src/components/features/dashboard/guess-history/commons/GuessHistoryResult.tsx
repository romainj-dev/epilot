import { GuessOutcome } from '@/graphql/generated/graphql'
import styles from './GuessHistoryResult.module.scss'
import {
  CircleCheck,
  CircleX,
  Circle,
  CircleMinus,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const OUTCOME_ICONS: Record<GuessOutcome, LucideIcon> = {
  [GuessOutcome.Win]: CircleCheck,
  [GuessOutcome.Loss]: CircleX,
  [GuessOutcome.Draw]: CircleMinus,
} as const

interface GuessHistoryResultIconProps {
  outcome: GuessOutcome | null | undefined
}

export function GuessHistoryResultIcon({
  outcome,
}: GuessHistoryResultIconProps) {
  const Icon = outcome ? OUTCOME_ICONS[outcome] : Circle
  return (
    <Icon
      className={styles.resultIcon}
      data-outcome={outcome?.toLowerCase() ?? 'failed'}
    />
  )
}

interface GuessHistoryResultProps {
  outcome: GuessOutcome | null | undefined
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
      <span
        className={styles.resultText}
        data-outcome={outcome?.toLowerCase() ?? 'failed'}
      >
        {outcome ? RESULT_TEXT[outcome] : t('result.failed')}
      </span>
    </div>
  )
}
