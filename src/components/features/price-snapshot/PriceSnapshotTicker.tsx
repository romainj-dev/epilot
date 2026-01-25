'use client'

import { useEffect, useState } from 'react'

import type { PriceSnapshot } from '@/types/price-snapshot'

type StreamMessage =
  | { type: 'snapshot'; payload: PriceSnapshot | null }
  | { type: 'error'; payload: { message: string } }

function useInitSSE({
  setSnapshot,
  setError,
}: {
  setSnapshot: (snapshot: PriceSnapshot | null) => void
  setError: (error: string) => void
}) {
  useEffect(() => {
    console.log('[Ticker] Creating EventSource')
    const source = new EventSource('/api/price-snapshot/stream')
    source.onopen = () => console.log('[Ticker] EventSource opened')

    function handleSnapshot(event: MessageEvent) {
      console.log('[Ticker] Received snapshot event:', event.data)
      const message = JSON.parse(event.data) as PriceSnapshot | null
      setSnapshot(message)
    }

    function handleError(event: MessageEvent) {
      if (!event.data) {
        setError('Price snapshot stream failed.')
        return
      }

      try {
        const message = JSON.parse(event.data) as StreamMessage['payload']
        if (message && typeof message === 'object' && 'message' in message) {
          setError(message.message)
        } else {
          setError('Price snapshot stream failed.')
        }
      } catch {
        setError('Price snapshot stream failed.')
      }
    }

    source.addEventListener('snapshot', handleSnapshot)
    source.addEventListener('error', handleError)

    source.onmessage = (event) =>
      console.log('[Ticker] Generic message:', event.data)

    source.onerror = (e) => {
      console.error('[Ticker] EventSource error:', e)
      setError('Price snapshot stream failed.')
    }

    return () => {
      source.removeEventListener('snapshot', handleSnapshot)
      source.removeEventListener('error', handleError)
      source.close()
    }
  }, [setError, setSnapshot])
}

function getFormattedPrice({ snapshot }: { snapshot: PriceSnapshot | null }) {
  if (!snapshot) {
    return null
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(snapshot.priceUsd)
}

export function PriceSnapshotTicker() {
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useInitSSE({ setSnapshot, setError })

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  const formattedPrice = getFormattedPrice({ snapshot })

  if (!snapshot || !formattedPrice) {
    return (
      <p className="text-sm text-muted-foreground">Loading latest price…</p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-muted-foreground">Latest BTC price</p>
      <p className="text-3xl font-semibold">{formattedPrice}</p>
      <p className="text-xs text-muted-foreground">
        {new Date(snapshot.capturedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
