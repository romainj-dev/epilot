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

export function formatUpdatedAt({
  snapshot,
}: {
  snapshot: PriceSnapshotStream | null
}) {
  if (!snapshot) {
    return null
  }
  // Fallback on capturedAt acceptable for now
  const updatedAt = snapshot.sourceUpdatedAt ?? snapshot.capturedAt
  return new Date(updatedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
