import { PriceSnapshotStream } from '@/types/price-snapshot'

export function getFormattedPrice({
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
