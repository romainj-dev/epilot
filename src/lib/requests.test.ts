/**
 * Unit tests for server-side GraphQL requests wrapper (requests.ts)
 *
 * Tests auth header selection and error mapping without real AppSync calls.
 */

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'
import { fetchGraphQL, fetchGraphQLProxy, AppSyncError } from './requests'

// Mock environment variables
const TEST_APPSYNC_ENDPOINT =
  'https://test.appsync-api.us-east-1.amazonaws.com/graphql'
const TEST_APPSYNC_API_KEY = 'test-api-key-12345'

describe('requests.ts - server GraphQL wrapper', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    // Set required env vars
    process.env.APPSYNC_ENDPOINT = TEST_APPSYNC_ENDPOINT
    process.env.APPSYNC_API_KEY = TEST_APPSYNC_API_KEY

    // Mock global fetch
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    delete process.env.APPSYNC_ENDPOINT
    delete process.env.APPSYNC_API_KEY
  })

  describe('fetchGraphQL - typed document variant', () => {
    const mockDocument = parse(
      'query GetUser($id: ID!) { getUser(id: $id) { id } }'
    ) as unknown as TypedDocumentNode<unknown, { id: string }>

    it('uses Authorization header when idToken is provided', async () => {
      const idToken = 'cognito-id-token-abc123'
      const mockData = { getUser: { id: '1', name: 'Test' } }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQL({
        document: mockDocument as unknown as TypedDocumentNode<
          unknown,
          { id: string }
        >,
        variables: { id: '1' },
        idToken,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            Authorization: idToken,
          }),
        })
      )

      // Should NOT include x-api-key when using idToken
      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'x-api-key': expect.anything(),
          }),
        })
      )
    })

    it('uses x-api-key header when idToken is not provided', async () => {
      const mockData = { listItems: [] }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQL({
        document: mockDocument as unknown as TypedDocumentNode<
          unknown,
          Record<string, never>
        >,
        variables: {},
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-api-key': TEST_APPSYNC_API_KEY,
          }),
        })
      )

      // Should NOT include Authorization when using API key
      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      )
    })

    it('throws AppSyncError when response is not ok', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      })

      try {
        await fetchGraphQL({
          document: mockDocument as unknown as TypedDocumentNode<
            unknown,
            Record<string, never>
          >,
          variables: {},
        })
        fail('Expected to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(AppSyncError)
        expect((error as Error).message).toContain(
          'AppSync request failed (403): Access denied'
        )
      }
    })

    it('throws AppSyncError with GraphQL errors when present in response', async () => {
      const graphqlErrors = [
        { message: 'Field not found', path: ['getUser', 'email'] },
        { message: 'Authorization failed' },
      ]

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: graphqlErrors }),
      })

      try {
        await fetchGraphQL({
          document: mockDocument as unknown as TypedDocumentNode<
            unknown,
            Record<string, never>
          >,
          variables: {},
        })
        fail('Expected to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(AppSyncError)
        expect((error as AppSyncError).errors).toEqual(graphqlErrors)
        expect((error as AppSyncError).message).toContain('GraphQL errors')
      }
    })

    it('throws AppSyncError when data is missing from response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // No data field
      })

      await expect(
        fetchGraphQL({
          document: mockDocument as unknown as TypedDocumentNode<
            unknown,
            Record<string, never>
          >,
          variables: {},
        })
      ).rejects.toThrow('AppSync returned no data')
    })

    it('returns data on successful request', async () => {
      const mockData = { getUser: { id: '1', name: 'Test User' } }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      const result = await fetchGraphQL({
        document: mockDocument as unknown as TypedDocumentNode<
          unknown,
          { id: string }
        >,
        variables: { id: '1' },
        idToken: 'test-token',
      })

      expect(result).toEqual(mockData)
    })
  })

  describe('fetchGraphQLProxy - raw query string variant', () => {
    it('uses Authorization header when idToken is provided', async () => {
      const idToken = 'test-cognito-token'
      const mockData = { test: 'value' }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQLProxy({
        query: 'query { test }',
        variables: {},
        idToken,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: idToken,
          }),
        })
      )
    })

    it('uses x-api-key header when idToken is not provided', async () => {
      const mockData = { public: 'data' }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQLProxy({
        query: 'query { public }',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        TEST_APPSYNC_ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': TEST_APPSYNC_API_KEY,
          }),
        })
      )
    })

    it('throws AppSyncError on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      })

      await expect(
        fetchGraphQLProxy({
          query: 'query { test }',
        })
      ).rejects.toThrow('AppSync request failed (500): Server error')
    })
  })
})
