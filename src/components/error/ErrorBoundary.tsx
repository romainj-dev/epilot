'use client'

import { Component, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button/Button'
import styles from './ErrorBoundary.module.scss'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Render inline error instead of full container */
  inline?: boolean
  /** Context for error reporting */
  context?: string
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

function InlineFallback({ onTryAgain }: { onTryAgain: () => void }) {
  const t = useTranslations('errorBoundary')
  return (
    <div className={styles.inline}>
      <span className={styles.inlineText}>{t('inlineError')}</span>
      <button className={styles.inlineButton} onClick={onTryAgain}>
        {t('retry')}
      </button>
    </div>
  )
}

function DefaultFallback({ onTryAgain }: { onTryAgain: () => void }) {
  const t = useTranslations('errorBoundary')
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h2 className={styles.title}>{t('title')}</h2>
        <p className={styles.description}>{t('description')}</p>
        <Button onClick={onTryAgain}>{t('tryAgain')}</Button>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { context, onError } = this.props

    console.error(
      `[ErrorBoundary${context ? `:${context}` : ''}]`,
      error,
      errorInfo
    )

    onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return this.props.inline ? (
        <InlineFallback onTryAgain={this.handleReset} />
      ) : (
        <DefaultFallback onTryAgain={this.handleReset} />
      )
    }

    return this.props.children
  }
}
