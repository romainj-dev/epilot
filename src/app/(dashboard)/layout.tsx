import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { Header } from '@/components/layout/header/Header'
import { authOptions } from '@/lib/auth'
import { PriceTicker } from '@/components/layout/header/PriceTicker'
import { UserPopover } from '@/components/layout/header/UserPopover'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth')
  }

  return (
    <>
      <Header center={<PriceTicker />} right={<UserPopover />} />
      <main>{children}</main>
    </>
  )
}
