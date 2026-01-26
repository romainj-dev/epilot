import { PriceSnapshotProvider } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { AnimatedBackground } from '@/components/layout/background/AnimatedBackground'
import { HeroSection } from '@/components/features/home/HeroSection'

export default function Home() {
  return (
    <PriceSnapshotProvider>
      <AnimatedBackground />
      <HeroSection />
    </PriceSnapshotProvider>
  )
}
