'use client'

import { useEffect } from 'react'
import ErrorPage from '@/components/error/ErrorPage'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return <ErrorPage error={error} reset={reset} />
}
