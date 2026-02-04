/**
 * AuthSignUp - User registration with email confirmation flow
 *
 * Two-step process: initial signup with password validation, followed by email
 * confirmation code entry. Handles Cognito registration and confirmation via API routes.
 */

'use client'

import { Button } from '@/components/ui/button/Button'
import { useRef, useState } from 'react'
import styles from './Auth.module.scss'
import { useTranslations } from 'next-intl'
import { TextInput } from '@/components/ui/form/TextInput'
import { useToast } from '@/hooks/use-toast'

interface AuthSignUpProps {
  setError: (error: string | null) => void
  onConfirmed: () => void
}

export function AuthSignUp({ setError, onConfirmed }: AuthSignUpProps) {
  const t = useTranslations('authSignUp')
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')

  const pendingEmail = useRef<string | null>(null)
  const [confirmationCode, setConfirmationCode] = useState('')

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (signUpPassword !== signUpConfirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }

    if (signUpPassword.length < 8) {
      setError(t('errors.passwordTooShort'))
      return
    }

    setError(null)
    setIsLoading(true)

    const response = await fetch('/api/cognito/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: signUpEmail,
        password: signUpPassword,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(data?.error ?? t('errors.signUpFailed'))
      setIsLoading(false)
      return
    }

    pendingEmail.current = signUpEmail
    setIsConfirming(true)
    setIsLoading(false)
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setError(null)
    setIsLoading(true)

    const response = await fetch('/api/cognito/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: pendingEmail.current,
        code: confirmationCode,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setError(data?.error ?? t('errors.confirmFailed'))
      setIsLoading(false)
      return
    }

    toast({ description: t('messages.confirmationSuccess') })
    onConfirmed()
  }

  return (
    <form
      onSubmit={isConfirming ? handleConfirm : handleSignUp}
      className={styles.form}
      data-testid="signup-form"
    >
      <TextInput
        id="signup-email"
        label={t('labels.email')}
        type="email"
        placeholder={t('placeholders.email')}
        value={signUpEmail}
        onChange={(e) => setSignUpEmail(e.target.value)}
        disabled={isLoading || isConfirming}
        autoComplete="email"
      />

      <TextInput
        id="signup-password"
        label={t('labels.password')}
        type="password"
        placeholder={t('placeholders.password')}
        value={signUpPassword}
        onChange={(e) => setSignUpPassword(e.target.value)}
        disabled={isLoading || isConfirming}
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
        disabled={isLoading || isConfirming}
        autoComplete="new-password"
      />

      {isConfirming && (
        <TextInput
          id="signup-code"
          label={t('labels.confirmCode')}
          type="text"
          placeholder={t('placeholders.confirmCode')}
          value={confirmationCode}
          onChange={(e) => setConfirmationCode(e.target.value)}
          disabled={isLoading}
          autoComplete="one-time-code"
        />
      )}

      {isConfirming && (
        <p className={styles.statusMessage} data-testid="signup-status-message">
          {t('messages.checkEmail')}
        </p>
      )}

      <Button
        type="submit"
        className={styles.submitButton}
        disabled={
          isLoading ||
          !signUpEmail ||
          !signUpPassword ||
          !signUpConfirmPassword ||
          (isConfirming && !confirmationCode)
        }
        isLoading={isLoading}
        data-testid="signup-submit"
      >
        {isConfirming ? t('button.confirm') : t('button.submit')}
      </Button>
    </form>
  )
}
