'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/Button'
import styles from './ErrorPage.module.scss'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('errorPage')

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.description}>{t('description')}</p>
        {error.digest && (
          <p className={styles.digest}>
            {t('digest', { digest: error.digest })}
          </p>
        )}
        <div className={styles.actions}>
          <Button onClick={reset}>{t('actions.tryAgain')}</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
          >
            {t('actions.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
