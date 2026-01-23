import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { BitcoinIcon } from '@/components/icons/BitcoinIcon'
import styles from './Header.module.scss'

interface HeaderProps {
  center?: React.ReactNode
  right: React.ReactNode
}

export async function Header({ center, right }: HeaderProps) {
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

          {center ?? null}

          {right ?? null}
        </div>
      </div>
    </header>
  )
}
