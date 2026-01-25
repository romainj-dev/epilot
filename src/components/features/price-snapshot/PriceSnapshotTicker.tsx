'use client'

import type { PriceSnapshotStream } from '@/types/price-snapshot'
import { usePriceSnapshot } from '@/components/features/price-snapshot/PriceSnapshotProvider'

function getFormattedPrice({
  snapshot,
}: {
  snapshot: PriceSnapshotStream | null
}) {
  if (!snapshot) {
    return null
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(snapshot.priceUsd)
}

export function PriceSnapshotTicker() {
  const { snapshot, error } = usePriceSnapshot()

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  const formattedPrice = getFormattedPrice({ snapshot })

  if (!snapshot || !formattedPrice) {
    return (
      <p className="text-sm text-muted-foreground">Loading latest price…</p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-muted-foreground">Latest BTC price</p>
      <p className="text-3xl font-semibold">{formattedPrice}</p>
      <p className="text-xs text-muted-foreground">
        {new Date(snapshot.capturedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
