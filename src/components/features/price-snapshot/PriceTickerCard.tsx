'use client'

import { useTranslations } from 'next-intl'
import { usePriceSnapshot } from './PriceSnapshotProvider'
import { getFormattedPrice } from './utils'
import styles from './PriceTickerCard.module.scss'
import { cn } from '@/lib/utils'

export function PriceTickerCard() {
  const t = useTranslations('priceSnapshot.card')
  const { snapshot } = usePriceSnapshot()

  const formattedPrice = getFormattedPrice({ snapshot })

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <div className={styles.priceSection}>
          <div className={styles.currencyBadge}>
            <span className={styles.currencyText}>{t('currency')}</span>
          </div>
          <div className={styles.priceInfo}>
            <span className={styles.pairLabel}>{t('pairLabel')}</span>
            {formattedPrice ? (
              <span className={styles.priceValue}>{formattedPrice}</span>
            ) : (
              <span
                className={cn(styles.priceValue, styles.priceValuePlaceholder)}
              >
                {t('placeholderPrice')}
              </span>
            )}
          </div>
        </div>
        <div className={styles.divider} />
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot}>
            <span className={styles.liveDotPing} />
            <span className={styles.liveDotCore} />
          </span>
          <span className={styles.liveText}>{t('live')}</span>
        </div>
      </div>
    </div>
  )
}
