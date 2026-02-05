/**
 * useCountdown - Live countdown timer for guess settlement
 *
 * Updates every 1 second for countdown text display.
 * Progress bar animation is handled by CSS for smooth rendering.
 * Auto-stops when countdown reaches zero to prevent unnecessary renders.
 */

import { useEffect, useState } from 'react'

const TICK_INTERVAL_MS = 1_000

function getSecondsRemaining(settleAt: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(settleAt).getTime() - Date.now()) / 1000)
  )
}

type UseCountdownParams = {
  settleAt: string
}

export function useCountdown({ settleAt }: UseCountdownParams) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const remaining = getSecondsRemaining(settleAt)
      setSecondsRemaining(remaining)
      return remaining
    }

    const initialRemaining = tick()
    if (initialRemaining <= 0) {
      return
    }

    const intervalId = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(intervalId)
      }
    }, TICK_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [settleAt])

  return { secondsRemaining }
}
