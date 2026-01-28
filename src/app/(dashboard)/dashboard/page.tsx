import { getTranslations } from 'next-intl/server'
import styles from './page.module.scss'
import { GuessAction } from '@/components/features/dashboard/GuessAction'
import { PriceTickerBig } from '@/components/features/price-snapshot/PriceTickerBig'
import { GuessHistory } from '@/components/features/dashboard/GuessHistory'

export async function generateMetadata() {
  const t = await getTranslations('dashboardPage')

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export default async function DashboardPage() {
  return (
    <div className={styles.main}>
      <PriceTickerBig />

      <GuessAction />

      <GuessHistory />
    </div>
  )
}
