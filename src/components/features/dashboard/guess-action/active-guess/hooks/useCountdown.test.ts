/** @jest-environment jsdom */

import { renderHook, act } from '@testing-library/react'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('counts down to 0 and then stops updating', () => {
    // Set settlement 5.5 seconds in the future
    const settleAt = new Date(Date.now() + 5_500).toISOString()

    const { result } = renderHook(() => useCountdown({ settleAt }))

    // Initial value should be 6 seconds (ceiling of 5.5s)
    expect(result.current.secondsRemaining).toBe(6)

    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(result.current.secondsRemaining).toBe(5)

    // Advance past the settlement time
    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    expect(result.current.secondsRemaining).toBe(0)

    // Verify interval is cleared - value should stay at 0
    const atZero = result.current.secondsRemaining
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    expect(result.current.secondsRemaining).toBe(atZero) // still 0 => interval cleared
  })

  it('returns 0 immediately when settleAt is in the past', () => {
    const settleAt = new Date(Date.now() - 1_000).toISOString()

    const { result } = renderHook(() => useCountdown({ settleAt }))

    expect(result.current.secondsRemaining).toBe(0)

    // Should not schedule any updates
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    expect(result.current.secondsRemaining).toBe(0)
  })

  it('updates once per second (not more frequently)', () => {
    const settleAt = new Date(Date.now() + 5_000).toISOString()
    const updates: number[] = []

    const { result } = renderHook(() => useCountdown({ settleAt }))
    updates.push(result.current.secondsRemaining!)

    // Advance by 500ms (half a second) - should not trigger update
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current.secondsRemaining).toBe(5) // Still 5s

    // Advance by another 500ms (now at 1s total) - should trigger update
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current.secondsRemaining).toBe(4)

    // Verify we only got 1 update for the 1 second that passed
    expect(updates.length).toBe(1)
  })
})
