/**
 * PriceTickerBadge - Header badges for price and score
 *
 * Compact display combining current Bitcoin price and user's game score.
 * Score badge changes color based on positive/negative value.
 */

'use client'

import { useTranslations } from 'next-intl'
import styles from './PriceTickerBadge.module.scss'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import { Badge } from '@/components/ui/badge/Badge'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { useUserState } from '@/components/features/user-state/UserStateProvider'
import { getFormattedPriceSnapshot } from './utils'

export function PriceTickerBadge() {
  const t = useTranslations('priceSnapshot.badge')
  const { snapshot } = usePriceSnapshot()
  const { userState } = useUserState()
  const score = userState?.score
  const scoreDisplay =
    score === undefined ? '' : score >= 0 ? `+${score}` : `${score}`

  return (
    <div className={styles.center}>
      <Badge variant={'outline'} className={styles.priceBadge}>
        <BitcoinIcon className={styles.priceIcon} />
        <span>
          {getFormattedPriceSnapshot({ priceUsd: snapshot?.priceUsd })}
        </span>
      </Badge>

      <Badge
        variant={
          score === undefined
            ? 'outline'
            : score >= 0
              ? 'default'
              : 'destructive'
        }
        className={styles.scoreBadge}
      >
        {t('scoreLabel')} {scoreDisplay}
      </Badge>
    </div>
  )
}
