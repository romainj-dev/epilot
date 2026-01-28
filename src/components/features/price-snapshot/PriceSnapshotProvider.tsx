'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

import type { PriceSnapshotStream } from '@/types/price-snapshot'

type PriceSnapshotContextValue = {
  snapshot: PriceSnapshotStream | null
  error: string | null
  priceDirection: 'up' | 'down' | null
}

const PriceSnapshotContext = createContext<PriceSnapshotContextValue>({
  snapshot: null,
  error: null,
  priceDirection: null,
})

const STREAM_URL = '/api/price-snapshot/stream'

export function PriceSnapshotProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [snapshot, setSnapshot] = useState<PriceSnapshotStream | null>(null)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const previousPriceRef = useRef<number | null>(null)

  function onSnapshot(snapshot: PriceSnapshotStream) {
    if (previousPriceRef.current) {
      if (snapshot.priceUsd > previousPriceRef.current) {
        setPriceDirection('up')
      } else if (snapshot.priceUsd < previousPriceRef.current) {
        setPriceDirection('down')
      }
    }
    previousPriceRef.current = snapshot?.priceUsd ?? null

    setSnapshot(snapshot)
  }

  function onError(error: string | null) {
    if (error === null) {
      return setError(null)
    }
    console.error('Price snapshot stream error:', error)
    setError(error)
  }

  useEffect(() => {
    const source = new EventSource(STREAM_URL)

    function handleSnapshot(event: MessageEvent) {
      const message = JSON.parse(event.data) as PriceSnapshotStream
      onSnapshot(message)
      onError(null)
    }

    function handleError(event: MessageEvent) {
      if (!event.data) {
        onError('Price snapshot stream failed.')
        return
      }

      try {
        const message = JSON.parse(event.data) as { message?: string }
        onError(message?.message ?? 'Price snapshot stream failed.')
      } catch {
        onError('Price snapshot stream failed.')
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

  const value = { snapshot, error, priceDirection }

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
