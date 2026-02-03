/**
 * Unit tests for AppSyncRealtimeClient
 *
 * Tests WebSocket subscription state machine without real network calls.
 * Uses mocked WebSocket and Jest fake timers.
 */

import { WebSocket } from 'ws'
import { parse } from 'graphql'
import { AppSyncRealtimeClient } from './appsync-realtime-client'

// Mock the ws module
jest.mock('ws')

const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>

describe('AppSyncRealtimeClient', () => {
  let mockWsInstance: jest.Mocked<WebSocket>

  type AnyRecord = Record<string, unknown>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Create a mock WebSocket instance
    mockWsInstance = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: WebSocket.CONNECTING,
    } as unknown as jest.Mocked<WebSocket>

    MockedWebSocket.mockImplementation(() => mockWsInstance)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('happy path: connection → subscription → data broadcast', () => {
    it('establishes connection, subscribes on ack, and broadcasts filtered data to all subscribers', () => {
      type TestData = { id: string; status: string }
      const client = new AppSyncRealtimeClient<TestData>()
      const subscriber1 = jest.fn()
      const subscriber2 = jest.fn()

      const testData: TestData = { id: '123', status: 'SETTLED' }

      const config = {
        endpoint: 'https://example.appsync-api.us-east-1.amazonaws.com/graphql',
        auth: { type: 'API_KEY' as const, apiKey: 'test-key' },
        subscription: {
          document: parse('subscription TestSub { onTestSub { id status } }'),
          operationName: 'TestSub',
          variables: { filter: 'test' },
          extractData: (payload: Record<string, unknown>) => payload.testData,
          validateData: (data: unknown): data is TestData =>
            typeof data === 'object' && data !== null && 'id' in data,
          filterData: (data: TestData) => data.status === 'SETTLED',
        },
        cleanupGraceMs: 1000,
        reconnectDelayMs: 500,
      }

      // Subscribe first client
      client.subscribe(config, { onData: subscriber1 }, null)

      // Capture event handlers registered on WebSocket
      expect(mockWsInstance.on).toHaveBeenCalled()
      const onCalls = (mockWsInstance.on as jest.Mock).mock.calls
      const onOpen = onCalls.find((call) => call[0] === 'open')?.[1]
      const onMessage = onCalls.find((call) => call[0] === 'message')?.[1]

      // Simulate WebSocket open
      ;(mockWsInstance as unknown as { readyState: number }).readyState =
        WebSocket.OPEN
      onOpen()

      // Should send connection_init
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'connection_init' })
      )

      // Simulate connection_ack from AppSync
      onMessage(JSON.stringify({ type: 'connection_ack' }))

      // Should send subscription start message
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"start"')
      )

      // Add second subscriber (should share same connection)
      client.subscribe(config, { onData: subscriber2 }, null)

      // Simulate data message from AppSync (with valid, filtered data)
      const dataMessage = {
        type: 'data',
        payload: {
          data: {
            testData: testData,
          },
        },
      }
      onMessage(JSON.stringify(dataMessage))

      // Both subscribers should receive the data
      expect(subscriber1).toHaveBeenCalledWith(testData)
      expect(subscriber2).toHaveBeenCalledWith(testData)
      expect(subscriber1).toHaveBeenCalledTimes(1)
      expect(subscriber2).toHaveBeenCalledTimes(1)

      // Simulate data that doesn't pass filter
      const unfilteredData: TestData = { id: '456', status: 'PENDING' }
      const unfilteredMessage = {
        type: 'data',
        payload: {
          data: {
            testData: unfilteredData,
          },
        },
      }
      onMessage(JSON.stringify(unfilteredMessage))

      // Subscribers should NOT be called again (filtered out)
      expect(subscriber1).toHaveBeenCalledTimes(1)
      expect(subscriber2).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnect on unexpected disconnect', () => {
    it('schedules reconnect after reconnectDelayMs when socket closes with active subscribers', () => {
      const client = new AppSyncRealtimeClient<AnyRecord>()
      const subscriber = jest.fn()

      const config = {
        endpoint: 'https://example.appsync-api.us-east-1.amazonaws.com/graphql',
        auth: { type: 'API_KEY' as const, apiKey: 'test-key' },
        subscription: {
          document: parse('subscription TestSub { onTestSub { id } }'),
          operationName: 'TestSub',
          variables: {},
          extractData: (payload: Record<string, unknown>) => payload.data,
          validateData: (data: unknown): data is AnyRecord =>
            typeof data === 'object' && data !== null,
        },
        reconnectDelayMs: 2000,
      }

      client.subscribe(config, { onData: subscriber }, null)

      const onCalls = (mockWsInstance.on as jest.Mock).mock.calls
      const onClose = onCalls.find((call) => call[0] === 'close')?.[1]

      // Clear previous WebSocket constructor calls
      MockedWebSocket.mockClear()

      // Simulate unexpected close
      onClose()

      // Should not reconnect immediately
      expect(MockedWebSocket).not.toHaveBeenCalled()

      // Advance time by reconnectDelayMs
      jest.advanceTimersByTime(2000)

      // Should have attempted reconnect (new WebSocket created)
      expect(MockedWebSocket).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup after last subscriber stops', () => {
    it('schedules disconnect after cleanupGraceMs when last subscriber stops', () => {
      const client = new AppSyncRealtimeClient<AnyRecord>()
      const subscriber1 = jest.fn()
      const subscriber2 = jest.fn()

      const config = {
        endpoint: 'https://example.appsync-api.us-east-1.amazonaws.com/graphql',
        auth: { type: 'API_KEY' as const, apiKey: 'test-key' },
        subscription: {
          document: parse('subscription TestSub { onTestSub { id } }'),
          operationName: 'TestSub',
          variables: {},
          extractData: (payload: Record<string, unknown>) => payload.data,
          validateData: (data: unknown): data is AnyRecord =>
            typeof data === 'object' && data !== null,
        },
        cleanupGraceMs: 3000,
      }

      // Subscribe two clients
      const handle1 = client.subscribe(config, { onData: subscriber1 }, null)
      const handle2 = client.subscribe(config, { onData: subscriber2 }, null)

      // Stop first subscriber
      handle1.stop()

      // Advance time - should NOT close yet (still has subscriber2)
      jest.advanceTimersByTime(3000)
      expect(mockWsInstance.close).not.toHaveBeenCalled()

      // Stop second (last) subscriber
      handle2.stop()

      // Should not close immediately
      expect(mockWsInstance.close).not.toHaveBeenCalled()

      // Advance time by cleanupGraceMs
      jest.advanceTimersByTime(3000)

      // Should now close the connection
      expect(mockWsInstance.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('forwards error callback when AppSync sends error message', () => {
      const client = new AppSyncRealtimeClient<AnyRecord>()
      const onData = jest.fn()
      const onError = jest.fn()

      const config = {
        endpoint: 'https://example.appsync-api.us-east-1.amazonaws.com/graphql',
        auth: { type: 'API_KEY' as const, apiKey: 'test-key' },
        subscription: {
          document: parse('subscription TestSub { onTestSub { id } }'),
          operationName: 'TestSub',
          variables: {},
          extractData: (payload: Record<string, unknown>) => payload.data,
          validateData: (data: unknown): data is AnyRecord =>
            typeof data === 'object' && data !== null,
        },
      }

      client.subscribe(config, { onData, onError }, null)

      const onCalls = (mockWsInstance.on as jest.Mock).mock.calls
      const onMessage = onCalls.find((call) => call[0] === 'message')?.[1]

      // Simulate error message from AppSync
      const errorMessage = {
        type: 'error',
        payload: { message: 'Subscription failed' },
      }
      onMessage(JSON.stringify(errorMessage))

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(onData).not.toHaveBeenCalled()
    })
  })

  describe('per-owner subscription isolation', () => {
    it('maintains separate WebSocket connections per owner', () => {
      const client = new AppSyncRealtimeClient<AnyRecord>()

      const config = {
        endpoint: 'https://example.appsync-api.us-east-1.amazonaws.com/graphql',
        auth: { type: 'COGNITO_USER_POOLS' as const, idToken: 'token1' },
        subscription: {
          document: parse(
            'subscription TestSub($owner: String!) { onTestSub(owner: $owner) { id } }'
          ),
          operationName: 'TestSub',
          variables: { owner: 'user1' },
          extractData: (payload: Record<string, unknown>) => payload.data,
          validateData: (data: unknown): data is AnyRecord =>
            typeof data === 'object' && data !== null,
        },
      }

      const config2 = {
        ...config,
        auth: { type: 'COGNITO_USER_POOLS' as const, idToken: 'token2' },
        subscription: {
          ...config.subscription,
          variables: { owner: 'user2' },
        },
      }

      // Subscribe with owner 'user1'
      client.subscribe(config, { onData: jest.fn() }, 'user1')

      // Should create first WebSocket
      expect(MockedWebSocket).toHaveBeenCalledTimes(1)

      MockedWebSocket.mockClear()

      // Subscribe with owner 'user2'
      client.subscribe(config2, { onData: jest.fn() }, 'user2')

      // Should create second WebSocket (different owner)
      expect(MockedWebSocket).toHaveBeenCalledTimes(1)
    })
  })
})
