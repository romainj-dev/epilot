import { GuessOutcome } from '@/graphql/generated/graphql'
import styles from './GuessHistoryPoints.module.scss'

const POINTS_DELTA: Record<GuessOutcome, number> = {
  [GuessOutcome.Win]: 1,
  [GuessOutcome.Loss]: -1,
  [GuessOutcome.Draw]: 0,
} as const

interface GuessHistoryPointsProps {
  outcome: GuessOutcome
}

export function GuessHistoryPoints({ outcome }: GuessHistoryPointsProps) {
  const pointsDelta = POINTS_DELTA[outcome]

  return (
    <span className={styles.points} data-outcome={outcome.toLowerCase()}>
      {pointsDelta === 0 ? '' : pointsDelta > 0 ? '+' : ''}
      {pointsDelta}
    </span>
  )
}
