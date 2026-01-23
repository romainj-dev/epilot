import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button/Button'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import styles from './Header.module.scss'

export async function Header() {
  const t = await getTranslations('header')

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIconWrapper}>
              <div className={styles.logoGlow} />
              <BitcoinIcon className={styles.logoIcon} />
            </div>
            <span className={styles.logoText}>
              {t('logo.prefix')}
              <span className={styles.logoAccent}>{t('logo.accent')}</span>
            </span>
          </Link>

          <div className={styles.cta}>
            <Button variant="ghost" size="sm" asChild className={styles.signIn}>
              <Link href="/auth">{t('cta.signIn')}</Link>
            </Button>
            <Button size="sm" asChild className={styles.getStarted}>
              <Link href="/auth">{t('cta.getStarted')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
