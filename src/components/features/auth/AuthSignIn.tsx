'use client'

import { TextInput } from '@/components/ui/form/TextInput'
import { Button } from '@/components/ui/button/Button'
import styles from './Auth.module.scss'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface AuthSignInProps {
  setError: (error: string | null) => void
}

export function AuthSignIn({ setError }: AuthSignInProps) {
  const router = useRouter()
  const t = useTranslations('authSignIn')

  const [isLoading, setIsLoading] = useState(false)
  // Sign in state
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!signInEmail || !signInPassword) {
      setError(t('errors.missingFields'))
      return
    }

    setIsLoading(true)

    // Mock auth - simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock success - route to dashboard
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSignIn} className={styles.form}>
      <TextInput
        id="signin-email"
        label={t('labels.email')}
        type="email"
        placeholder={t('placeholders.email')}
        value={signInEmail}
        onChange={(e) => setSignInEmail(e.target.value)}
        disabled={isLoading}
        autoComplete="email"
      />

      <TextInput
        id="signin-password"
        label={t('labels.password')}
        type="password"
        placeholder={t('placeholders.password')}
        value={signInPassword}
        onChange={(e) => setSignInPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="current-password"
      />

      <Button
        type="submit"
        className={styles.submitButton}
        disabled={isLoading || !signInEmail || !signInPassword}
        isLoading={isLoading}
      >
        {t('button.submit')}
      </Button>
    </form>
  )
}
