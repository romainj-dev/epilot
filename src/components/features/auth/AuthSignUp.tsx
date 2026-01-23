'use client'

import { Button } from '@/components/ui/button/Button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './Auth.module.scss'
import { useTranslations } from 'next-intl'
import { TextInput } from '@/components/ui/form/TextInput'

interface AuthSignUpProps {
  setError: (error: string | null) => void
}

export function AuthSignUp({ setError }: AuthSignUpProps) {
  const router = useRouter()
  const t = useTranslations('authSignUp')
  const [isLoading, setIsLoading] = useState(false)

  // Sign up state
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!signUpEmail || !signUpPassword || !signUpConfirmPassword) {
      setError(t('errors.missingFields'))
      return
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }

    if (signUpPassword.length < 8) {
      setError(t('errors.passwordTooShort'))
      return
    }

    setIsLoading(true)

    // Mock auth - simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock success - route to dashboard
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSignUp} className={styles.form}>
      <TextInput
        id="signup-email"
        label={t('labels.email')}
        type="email"
        placeholder={t('placeholders.email')}
        value={signUpEmail}
        onChange={(e) => setSignUpEmail(e.target.value)}
        disabled={isLoading}
        autoComplete="email"
      />

      <TextInput
        id="signup-password"
        label={t('labels.password')}
        type="password"
        placeholder={t('placeholders.password')}
        value={signUpPassword}
        onChange={(e) => setSignUpPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="new-password"
        hint={t('hints.password')}
      />

      <TextInput
        id="signup-confirm"
        label={t('labels.confirmPassword')}
        type="password"
        placeholder={t('placeholders.confirmPassword')}
        value={signUpConfirmPassword}
        onChange={(e) => setSignUpConfirmPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="new-password"
      />

      <Button
        type="submit"
        className={styles.submitButton}
        disabled={
          isLoading || !signUpEmail || !signUpPassword || !signUpConfirmPassword
        }
        isLoading={isLoading}
      >
        {t('button.submit')}
      </Button>
    </form>
  )
}
