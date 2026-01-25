'use client'

import { createContext, useContext, useEffect, useState } from 'react'

import type { PriceSnapshotStream } from '@/types/price-snapshot'

type PriceSnapshotContextValue = {
  snapshot: PriceSnapshotStream | null
  error: string | null
}

const PriceSnapshotContext = createContext<PriceSnapshotContextValue>({
  snapshot: null,
  error: null,
})

const STREAM_URL = '/api/price-snapshot/stream'

export function PriceSnapshotProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [snapshot, setSnapshot] = useState<PriceSnapshotStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const source = new EventSource(STREAM_URL)

    function handleSnapshot(event: MessageEvent) {
      const message = JSON.parse(event.data) as PriceSnapshotStream | null
      setSnapshot(message)
      setError(null)
    }

    function handleError(event: MessageEvent) {
      if (!event.data) {
        setError('Price snapshot stream failed.')
        return
      }

      try {
        const message = JSON.parse(event.data) as { message?: string }
        setError(message?.message ?? 'Price snapshot stream failed.')
      } catch {
        setError('Price snapshot stream failed.')
      }
    }

    source.addEventListener('snapshot', handleSnapshot)
    source.addEventListener('error', handleError)
    source.onerror = () => setError('Price snapshot stream failed.')

    return () => {
      source.removeEventListener('snapshot', handleSnapshot)
      source.removeEventListener('error', handleError)
      source.close()
    }
  }, [])

  const value = { snapshot, error }

  return (
    <PriceSnapshotContext.Provider value={value}>
      {children}
    </PriceSnapshotContext.Provider>
  )
}

export function usePriceSnapshot() {
  const context = useContext(PriceSnapshotContext)
  if (!context) {
    throw new Error(
      'usePriceSnapshot must be used within PriceSnapshotProvider'
    )
  }
  return context
}
