/**
 * GuessHistoryPoints - Score delta display for settled guesses
 *
 * Shows +1, -1, or 0 points with color-coding based on guess outcome.
 * Failed guesses (no outcome) display as 0 points.
 */

import { GuessOutcome } from '@/graphql/generated/graphql'
import styles from './GuessHistoryPoints.module.scss'

const POINTS_DELTA: Record<GuessOutcome, number> = {
  [GuessOutcome.Win]: 1,
  [GuessOutcome.Loss]: -1,
  [GuessOutcome.Draw]: 0,
} as const

interface GuessHistoryPointsProps {
  outcome: GuessOutcome | null | undefined
}

export function GuessHistoryPoints({ outcome }: GuessHistoryPointsProps) {
  // No outcome means failed guess
  const pointsDelta = outcome ? POINTS_DELTA[outcome] : 0

  return (
    <span
      className={styles.points}
      data-outcome={outcome?.toLowerCase() ?? 'failed'}
    >
      {pointsDelta === 0 ? '' : pointsDelta > 0 ? '+' : ''}
      {pointsDelta}
    </span>
  )
}
