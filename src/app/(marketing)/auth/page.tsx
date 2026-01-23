import { getTranslations } from 'next-intl/server'
import { AuthTabs } from '@/components/features/auth/AuthTabs'
import styles from './page.module.scss'

export async function generateMetadata() {
  const t = await getTranslations('authPage')

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

/**
 * Subtle background for the auth page
 */
function Background() {
  return (
    <div className={styles.background}>
      <div className={styles.gradient} />
      <div className={styles.gridPattern} />
    </div>
  )
}

export default function AuthPage() {
  return (
    <main className={styles.main}>
      <Background />
      <AuthTabs />
    </main>
  )
}
