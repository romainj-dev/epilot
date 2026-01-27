/**
 * Unit tests for the GraphQL proxy route
 *
 * Mocks:
 * - @/lib/auth (auth session)
 * - @/lib/requests (fetchGraphQLProxy, AppSyncError)
 */

import { NextRequest } from 'next/server'

type SessionLike = { cognitoIdToken?: string } | null
type GraphQLProxyArgs = {
  query: string
  variables?: Record<string, unknown>
  idToken?: string
}

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn<Promise<SessionLike>, []>(),
}))

// Mock requests
jest.mock('@/lib/requests', () => ({
  fetchGraphQLProxy: jest.fn<Promise<unknown>, [GraphQLProxyArgs]>(),
  AppSyncError: class AppSyncError extends Error {
    constructor(
      message: string,
      public readonly errors?: unknown[]
    ) {
      super(message)
      this.name = 'AppSyncError'
    }
  },
}))

import { auth } from '@/lib/auth'
import { fetchGraphQLProxy, AppSyncError } from '@/lib/requests'

const mockAuth = auth as unknown as jest.MockedFunction<
  () => Promise<SessionLike>
>
const mockFetchGraphQLProxy =
  fetchGraphQLProxy as unknown as jest.MockedFunction<
    (args: GraphQLProxyArgs) => Promise<unknown>
  >

let POST: (req: NextRequest) => Promise<Response>

describe('POST /api/graphql', () => {
  beforeAll(async () => {
    // Ensure route imports see the mocked modules above.
    const route = await import('./route')
    POST = route.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { test }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(mockFetchGraphQLProxy).not.toHaveBeenCalled()
  })

  it('should return 401 when session exists but has no cognitoIdToken', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2099-01-01',
    } as unknown as SessionLike)

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { test }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
    expect(mockFetchGraphQLProxy).not.toHaveBeenCalled()
  })

  it('should return 400 when query is missing', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid query' })
    expect(mockFetchGraphQLProxy).not.toHaveBeenCalled()
  })

  it('should return 400 when query is not a string', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 123,
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'Missing or invalid query' })
    expect(mockFetchGraphQLProxy).not.toHaveBeenCalled()
  })

  it('should proxy GraphQL request and return data on success', async () => {
    const idToken = 'test-cognito-id-token'
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: idToken,
    })

    const query = 'query GetUser($id: ID!) { getUser(id: $id) { id name } }'
    const variables = { id: 'user-123' }
    const mockData = { getUser: { id: 'user-123', name: 'Test User' } }

    mockFetchGraphQLProxy.mockResolvedValueOnce(mockData as unknown)

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ data: mockData })
    expect(mockFetchGraphQLProxy).toHaveBeenCalledWith({
      query,
      variables,
      idToken,
    })
  })

  it('should handle AppSyncError and return 200 with errors (GraphQL convention)', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    const graphqlErrors = [
      { message: 'Field error', path: ['getUser', 'name'] },
    ]
    mockFetchGraphQLProxy.mockRejectedValueOnce(
      new AppSyncError('GraphQL errors', graphqlErrors)
    )

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { getUser { id } }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ errors: graphqlErrors })
  })

  it('should handle AppSyncError without errors array and wrap message', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    mockFetchGraphQLProxy.mockRejectedValueOnce(
      new AppSyncError('Connection timeout')
    )

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { test }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ errors: [{ message: 'Connection timeout' }] })
  })

  it('should return 500 for unknown errors', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    mockFetchGraphQLProxy.mockRejectedValueOnce(
      new Error('Unexpected internal error')
    )

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { test }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ errors: [{ message: 'Unexpected internal error' }] })
  })

  it('should return 500 with generic message when error has no message', async () => {
    mockAuth.mockResolvedValueOnce({
      cognitoIdToken: 'test-token',
    })

    mockFetchGraphQLProxy.mockRejectedValueOnce({})

    const req = new NextRequest('http://localhost:3000/api/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: 'query { test }',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ errors: [{ message: 'Internal error' }] })
  })
})
