'use client'

import { useEffect } from 'react'
import ErrorPage from '@/components/error/ErrorPage'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application Error:', error)
  }, [error])

  return <ErrorPage error={error} reset={reset} />
}
