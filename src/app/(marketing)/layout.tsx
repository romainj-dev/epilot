import { CTA } from '@/components/layout/header/CTA'
import { Header } from '@/components/layout/header/Header'

interface MarketingLayoutProps {
  children: React.ReactNode
}
export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <>
      <Header right={<CTA />} />
      <main>{children}</main>
    </>
  )
}
