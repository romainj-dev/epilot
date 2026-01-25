import { PriceSnapshotProvider } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { PriceSnapshotTicker } from '@/components/features/price-snapshot/PriceSnapshotTicker'

export default function Home() {
  return (
    <PriceSnapshotProvider>
      <div>HOME</div>
      <PriceSnapshotTicker />
    </PriceSnapshotProvider>
  )
}
