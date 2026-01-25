'use client'

import styles from './PriceTicker.module.scss'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import { Skeleton } from '@/components/ui/skeleton/Skeleton'
import { Badge } from '@/components/ui/badge/Badge'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { useUserState } from '@/components/features/user-state/UserStateProvider'

function formatPrice(p: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p)
}

export function PriceTicker() {
  const { snapshot } = usePriceSnapshot()
  const { userState } = useUserState()
  const score = userState?.score

  const price = snapshot?.priceUsd ?? null
  const isLoadingPrice = !snapshot

  return (
    <div className={styles.center}>
      {/* Live BTC Price Chip */}
      <div className={styles.priceChip}>
        <BitcoinIcon className={styles.priceIcon} />
        {isLoadingPrice || price === null ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <span className={styles.priceValue}>{formatPrice(price)}</span>
        )}
      </div>

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
        Score: {score === undefined ? '' : score >= 0 ? `+${score}` : score}
      </Badge>
    </div>
  )
}
