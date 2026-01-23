'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/Card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs/Tabs'
import styles from './AuthTabs.module.scss'
import { AuthSignIn } from './AuthSignIn'
import { AuthSignUp } from './AuthSignUp'

export function AuthTabs() {
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('authTabs')

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft className={styles.backIcon} />
          {t('backToHome')}
        </Link>
        <CardTitle className={styles.title}>{t('title')}</CardTitle>
        <CardDescription className={styles.description}>
          {t('description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs
          defaultValue="signin"
          className="w-full"
          onValueChange={() => setError(null)}
        >
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="signin" className={styles.tabsTrigger}>
              {t('tabs.signIn')}
            </TabsTrigger>
            <TabsTrigger value="signup" className={styles.tabsTrigger}>
              {t('tabs.signUp')}
            </TabsTrigger>
          </TabsList>

          {/* Error display */}
          {error && (
            <div className={styles.error}>
              <AlertCircle className={styles.errorIcon} />
              {error}
            </div>
          )}

          <TabsContent value="signin">
            <AuthSignIn setError={setError} />
          </TabsContent>

          <TabsContent value="signup">
            <AuthSignUp setError={setError} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
