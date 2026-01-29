'use client'

import { useEffect } from 'react'
import ErrorPage from '@/components/error/ErrorPage'

interface MarketingErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MarketingError({ error, reset }: MarketingErrorProps) {
  useEffect(() => {
    console.error('[Marketing Error]', error)
  }, [error])

  return <ErrorPage error={error} reset={reset} />
}
