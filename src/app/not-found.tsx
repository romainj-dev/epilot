import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button/Button'
import styles from './not-found.module.scss'

export default async function NotFound() {
  const t = await getTranslations('notFoundPage')

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('code')}</h1>
        <h2 className={styles.subtitle}>{t('subtitle')}</h2>
        <p className={styles.description}>{t('description')}</p>
        <Link href="/">
          <Button>{t('backToHome')}</Button>
        </Link>
      </div>
    </div>
  )
}
