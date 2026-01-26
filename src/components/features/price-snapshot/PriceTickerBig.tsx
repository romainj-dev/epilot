'use client'

import { useTranslations } from 'next-intl'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { getFormattedPrice } from './utils'

export function PriceTickerBig() {
  const t = useTranslations('priceSnapshot.big')
  const { snapshot, error } = usePriceSnapshot()

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>
  }

  const formattedPrice = getFormattedPrice({ snapshot })

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-muted-foreground">{t('latestLabel')}</p>
      <p className="text-3xl font-semibold">{formattedPrice}</p>
      <p className="text-xs text-muted-foreground">
        {new Date(snapshot.capturedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
