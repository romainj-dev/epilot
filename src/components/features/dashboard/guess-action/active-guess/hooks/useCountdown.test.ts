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
    const values: number[] = []

    const settleAt = new Date(Date.now() + 250).toISOString()

    const { result } = renderHook(() => useCountdown({ settleAt }))

    // capture initial value (hook ticks immediately on mount)
    values.push(result.current)
    expect(result.current).toBeGreaterThan(0)

    act(() => {
      jest.advanceTimersByTime(300) // crosses 250ms
    })
    values.push(result.current)
    expect(result.current).toBe(0)

    const atZero = result.current
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(atZero) // still 0 => interval cleared / no more updates
  })
})
