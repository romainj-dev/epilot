type GetFormattedPriceSnapshotParams = {
  priceUsd: number | undefined
}
export function getFormattedPriceSnapshot({
  priceUsd,
}: GetFormattedPriceSnapshotParams) {
  if (!priceUsd) {
    return null
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(priceUsd)
}

type GetFormattedDateTimeSnapshotParams = {
  timestamp: string | null | undefined
}
export function getFormattedDateTimeSnapshot({
  timestamp,
}: GetFormattedDateTimeSnapshotParams) {
  if (!timestamp) {
    return null
  }
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
