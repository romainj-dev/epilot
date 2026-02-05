/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react'
import { useGuessSettlementStream } from './useGuessSettlementStream'
import { GuessStatus } from '@/graphql/generated/graphql'

jest.mock('@/hooks/use-session', () => ({
  useSession: () => ({ data: { user: { id: 'user-123' } } }),
}))

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockQueryClient = {
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
}

jest.mock('@/hooks/requests', () => ({
  useQueryClient: () => mockQueryClient,
}))

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Map<string, EventListener[]> = new Map()
  onopen: (() => void) | null = null
  onerror: ((error: Event) => void) | null = null
  readyState = 0
  CONNECTING = 0
  OPEN = 1
  CLOSED = 2

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  removeEventListener(event: string, listener: EventListener) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  close() {
    this.readyState = this.CLOSED
  }

  simulateEvent(event: string, data: string) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const messageEvent = new MessageEvent(event, { data })
      listeners.forEach((listener) => listener(messageEvent))
    }
  }

  static reset() {
    MockEventSource.instances = []
  }
}

global.EventSource = MockEventSource as unknown as typeof EventSource

describe('useGuessSettlementStream', () => {
  beforeEach(() => {
    MockEventSource.reset()
    mockQueryClient.setQueryData.mockClear()
    mockQueryClient.invalidateQueries.mockClear()
    jest.clearAllMocks()
  })

  it('should not connect when secondsRemaining > 2', () => {
    renderHook(() =>
      useGuessSettlementStream({
        guessId: 'guess-123',
        secondsRemaining: 10,
      })
    )

    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('should connect when secondsRemaining <= 2', () => {
    renderHook(() =>
      useGuessSettlementStream({
        guessId: 'guess-123',
        secondsRemaining: 2,
      })
    )

    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('/api/guess/stream')
  })

  it('should close EventSource on unmount', () => {
    const { unmount } = renderHook(() =>
      useGuessSettlementStream({
        guessId: 'guess-123',
        secondsRemaining: 1,
      })
    )

    const eventSource = MockEventSource.instances[0]
    expect(eventSource.readyState).not.toBe(eventSource.CLOSED)

    unmount()

    expect(eventSource.readyState).toBe(eventSource.CLOSED)
  })

  it('should handle settlement for matching guessId', async () => {
    renderHook(() =>
      useGuessSettlementStream({
        guessId: 'guess-123',
        secondsRemaining: 1,
      })
    )

    const settledGuess = {
      id: 'guess-123',
      status: GuessStatus.Settled,
      outcome: 'WIN',
      endPrice: 50000,
    }

    MockEventSource.instances[0].simulateEvent(
      'settled',
      JSON.stringify(settledGuess)
    )

    await waitFor(() => {
      expect(mockQueryClient.setQueryData).toHaveBeenCalled()
    })

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: expect.arrayContaining(['userState', 'user-123']),
    })
  })

  it('should ignore settlement for non-matching guessId', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    renderHook(() =>
      useGuessSettlementStream({
        guessId: 'guess-123',
        secondsRemaining: 1,
      })
    )

    const otherGuess = {
      id: 'guess-456',
      status: GuessStatus.Settled,
    }

    MockEventSource.instances[0].simulateEvent(
      'settled',
      JSON.stringify(otherGuess)
    )

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SSE] Received settled event for wrong guess:',
        'guess-456'
      )
    })

    expect(mockQueryClient.setQueryData).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should reconnect when secondsRemaining transitions to buffer window', () => {
    const { rerender } = renderHook(
      ({ secondsRemaining }) =>
        useGuessSettlementStream({
          guessId: 'guess-123',
          secondsRemaining,
        }),
      { initialProps: { secondsRemaining: 10 } }
    )

    expect(MockEventSource.instances).toHaveLength(0)

    rerender({ secondsRemaining: 2 })

    expect(MockEventSource.instances).toHaveLength(1)
  })
})
