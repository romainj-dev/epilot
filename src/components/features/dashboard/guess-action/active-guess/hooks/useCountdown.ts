import { Guess } from '@/graphql/generated/graphql'
import { useEffect, useState } from 'react'

const TICK_INTERVAL_MS = 100

function getTimeRemaining(settleAt: string): number {
  return Math.max(0, new Date(settleAt).getTime() - Date.now())
}

type UseCountdownParams = {
  guess: Guess
}

export function useCountdown({ guess }: UseCountdownParams): number {
  const settleAt = guess.settleAt
  const [timeRemaining, setTimeRemaining] = useState(0)

  useEffect(() => {
    const tick = () => {
      const remaining = getTimeRemaining(settleAt)
      setTimeRemaining(remaining)
      return remaining
    }

    // Sync immediately with current time
    if (tick() <= 0) return

    // Tick every 100ms for smooth progress bar updates
    const intervalId = setInterval(() => {
      if (tick() <= 0) clearInterval(intervalId)
    }, TICK_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [settleAt])

  return settleAt ? timeRemaining : 0
}
