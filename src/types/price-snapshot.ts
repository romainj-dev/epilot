export type PriceSnapshot = {
  id: string
  pk: string
  capturedAt: string
  sourceUpdatedAt?: string | null
  priceUsd: number
  source?: string | null
}
