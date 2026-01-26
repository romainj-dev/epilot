import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header/Header'
import { auth } from '@/lib/auth'
import { PriceTickerBadge } from '@/components/features/price-snapshot/PriceTickerBadge'
import { UserPopover } from '@/components/layout/header/UserPopover'
import { PriceSnapshotProvider } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import { UserStateProvider } from '@/components/features/user-state/UserStateProvider'

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
      <UserStateProvider userId={session.user.id}>
        <Header center={<PriceTickerBadge />} right={<UserPopover />} />
        <main>{children}</main>
      </UserStateProvider>
    </PriceSnapshotProvider>
  )
}
