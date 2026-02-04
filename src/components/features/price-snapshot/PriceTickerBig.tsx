/**
 * PriceTickerBig - Large Bitcoin price display with trend indicator
 *
 * Primary price display on the dashboard showing real-time BTC/USD price.
 * Includes directional trend icons and flash animations on price changes.
 */

'use client'

import { useTranslations } from 'next-intl'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import {
  getFormattedPriceSnapshot,
  getFormattedDateTimeSnapshot,
} from './utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card/Card'
import styles from './PriceTickerBig.module.scss'
import { cn } from '@/lib/utils'

interface TrendProps {
  priceDirection: 'up' | 'down' | null
}

function Trend({ priceDirection }: TrendProps) {
  function getTrendClass() {
    if (priceDirection === 'up') return styles.trendUp
    if (priceDirection === 'down') return styles.trendDown
    return ''
  }

  return (
    <span className={cn(styles.trendIcon, getTrendClass())}>
      {priceDirection === 'up' ? (
        <TrendingUp
          className={styles.trendIcon}
          data-testid="price-trend-icon-up"
        />
      ) : priceDirection === 'down' ? (
        <TrendingDown
          className={styles.trendIcon}
          data-testid="price-trend-icon-down"
        />
      ) : null}
    </span>
  )
}

interface UpdatedAtProps {
  updatedAt: string | null
}

function UpdatedAt({ updatedAt }: UpdatedAtProps) {
  const t = useTranslations('priceSnapshot.big')

  return (
    <div
      className={cn(styles.timestamp, !updatedAt ? styles.hidden : '')}
      data-testid="price-updated-at"
    >
      <Minus className={styles.timestampIcon} />
      <span>
        {t('lastUpdatedLabel')} {updatedAt}
      </span>
    </div>
  )
}

interface PriceDisplayProps {
  price: string | null
  priceDirection: 'up' | 'down' | null
}

function PriceDisplay({ price, priceDirection }: PriceDisplayProps) {
  const t = useTranslations('priceSnapshot.big')

  function getFlashClass() {
    if (priceDirection === 'up') return styles.flashUp
    if (priceDirection === 'down') return styles.flashDown
    return ''
  }

  return (
    <div className={styles.priceWrapper}>
      {!price ? (
        <div className={cn(styles.priceDisplay, styles.hidden)}>
          <span className={styles.priceValue} data-testid="price-value">
            {t('loading')}
          </span>
        </div>
      ) : (
        <div className={cn(styles.priceDisplay, getFlashClass())}>
          <span className={styles.priceValue} data-testid="price-value">
            {price}
          </span>
        </div>
      )}
    </div>
  )
}

export function PriceTickerBig() {
  const t = useTranslations('priceSnapshot.big')
  const { snapshot, error, priceDirection } = usePriceSnapshot()

  const price = getFormattedPriceSnapshot({ priceUsd: snapshot?.priceUsd })
  const updatedAt = getFormattedDateTimeSnapshot({
    timestamp: snapshot?.sourceUpdatedAt,
  })
  const animationKey = updatedAt ?? 'LOADING'

  return (
    <Card className={styles.card}>
      <CardContent className={styles.content}>
        {error ? (
          <p className={styles.error}>{t('error')}</p>
        ) : (
          <div className={styles.inner}>
            <div className={styles.label}>
              <span className={styles.labelText}>{t('pairLabel')}</span>
              <Trend priceDirection={priceDirection} />
            </div>

            <PriceDisplay
              key={animationKey}
              price={price}
              priceDirection={priceDirection}
            />

            <UpdatedAt updatedAt={updatedAt} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
