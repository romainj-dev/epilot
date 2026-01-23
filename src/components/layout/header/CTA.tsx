import { Button } from '@/components/ui/button/Button'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import styles from './CTA.module.scss'

export async function CTA() {
  const t = await getTranslations('header')
  const session = await getServerSession(authOptions)
  const isAuthenticated = Boolean(session?.user)

  return (
    <div className={styles.cta}>
      <Button variant="ghost" size="sm" asChild className={styles.signIn}>
        <Link href={isAuthenticated ? '/dashboard' : '/auth'}>
          {isAuthenticated ? t('cta.dashboard') : t('cta.signIn')}
        </Link>
      </Button>
    </div>
  )
}
