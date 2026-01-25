import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header/Header'
import { auth } from '@/lib/auth'
import { PriceTicker } from '@/components/layout/header/PriceTicker'
import { UserPopover } from '@/components/layout/header/UserPopover'
import { PriceSnapshotProvider } from '@/components/features/price-snapshot/PriceSnapshotProvider'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth')
  }

  return (
    <PriceSnapshotProvider>
      <Header center={<PriceTicker />} right={<UserPopover />} />
      <main>{children}</main>
    </PriceSnapshotProvider>
  )
}
