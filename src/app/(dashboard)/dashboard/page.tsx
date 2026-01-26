import { PriceTickerBig } from '@/components/features/price-snapshot/PriceTickerBig'

export default async function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <PriceTickerBig />
    </main>
  )
}
