/**
 * Unit tests for client-side GraphQL request wrapper (requests-client.ts)
 *
 * Tests request contract and error mapping for client → BFF GraphQL proxy.
 */

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'
import { fetchGraphQLClient, GraphQLError } from './requests-client'

describe('requests-client.ts - client GraphQL wrapper', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe('request contract', () => {
    it('posts to /api/graphql with operationName, query, and variables', async () => {
      const mockDocument = parse(
        'query GetUser($id: ID!) { getUser(id: $id) { id name } }'
      ) as unknown as TypedDocumentNode<unknown, { id: string }>

      const variables = { id: 'user-123' }
      const mockData = { getUser: { id: 'user-123', name: 'Test User' } }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQLClient(mockDocument, variables)

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        })
      )

      // Extract body with type safety for JSON parsing
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      const requestBody = JSON.parse(options.body as string)
      expect(requestBody).toEqual({
        operationName: 'GetUser',
        query: expect.any(String),
        variables,
      })
    })

    it('handles documents without operation name', async () => {
      const mockDocument = parse(
        'query { __typename }'
      ) as unknown as TypedDocumentNode<unknown, Record<string, never>>

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })

      await fetchGraphQLClient(mockDocument, {})

      // Extract body with type safety for JSON parsing
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      const requestBody = JSON.parse(options.body as string)
      expect(requestBody.operationName).toBeUndefined()
    })
  })

  describe('error mapping', () => {
    const mockDocument = parse(
      'query { __typename }'
    ) as unknown as TypedDocumentNode<unknown, Record<string, never>>

    it('throws GraphQLError on non-2xx HTTP response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      try {
        await fetchGraphQLClient(mockDocument, {})
        fail('Expected to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError)
        expect((error as Error).message).toContain('HTTP error: 401')
      }
    })

    it('throws GraphQLError when response contains errors array', async () => {
      const errors = [
        { message: 'Field "email" not found' },
        { message: 'Unauthorized access' },
      ]

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors }),
      })

      try {
        await fetchGraphQLClient(mockDocument, {})
        fail('Expected to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError)
        expect((error as GraphQLError).message).toBe(
          'Field "email" not found, Unauthorized access'
        )
        expect((error as GraphQLError).errors).toEqual(errors)
      }
    })

    it('throws GraphQLError when data is missing from response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // No data field
      })

      await expect(fetchGraphQLClient(mockDocument, {})).rejects.toThrow(
        'No data returned'
      )
    })
  })

  describe('successful requests', () => {
    const mockDocument = parse(
      'query { __typename }'
    ) as unknown as TypedDocumentNode<unknown, Record<string, never>>

    it('returns data on successful request', async () => {
      const mockData = {
        listItems: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
        ],
      }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      const result = await fetchGraphQLClient(mockDocument, {})

      expect(result).toEqual(mockData)
    })

    it('passes variables correctly to the GraphQL endpoint', async () => {
      const variables = {
        filter: { status: 'ACTIVE' },
        limit: 20,
      }
      const mockData = { items: [] }

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData }),
      })

      await fetchGraphQLClient(
        mockDocument as unknown as TypedDocumentNode<
          unknown,
          { filter: { status: string }; limit: number }
        >,
        variables
      )

      // Extract body with type safety for JSON parsing
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
      const requestBody = JSON.parse(options.body as string)
      expect(requestBody.variables).toEqual(variables)
    })
  })
})
