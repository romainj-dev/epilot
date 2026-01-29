import { getTranslations } from 'next-intl/server'
import { Skeleton } from '@/components/ui/skeleton/Skeleton'
import styles from './loading.module.scss'

export default async function Loading() {
  const t = await getTranslations('loadingPage')

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Skeleton className={styles.spinner} />
        <p className={styles.text}>{t('text')}</p>
      </div>
    </div>
  )
}
