/**
 * Server-side GraphQL request handler for AppSync
 *
 * Direct AppSync client for server components, API routes, and server actions.
 * Supports both API key (public queries) and Cognito token (user-specific queries).
 */

import 'server-only'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

import { getAppSyncApiKey, getAppSyncEndpoint } from '@/lib/env'

export class AppSyncError extends Error {
  constructor(
    message: string,
    public readonly errors?: unknown[]
  ) {
    super(message)
    this.name = 'AppSyncError'
  }
}

/**
 * Core AppSync GraphQL executor with authentication and error handling
 *
 * Handles auth token selection (Cognito vs API key), HTTP errors, and GraphQL errors.
 * Used by both typed document and raw query public APIs.
 *
 * @param params - Execution parameters
 * @param params.query - GraphQL query string
 * @param params.variables - Optional GraphQL variables
 * @param params.idToken - Optional Cognito token (uses API key if omitted)
 * @returns Typed GraphQL response data
 * @throws {AppSyncError} On HTTP errors, GraphQL errors, or missing data
 */
async function executeGraphQL<TData>(params: {
  query: string
  variables?: Record<string, unknown>
  idToken?: string
}): Promise<TData> {
  const { query, variables, idToken } = params

  const response = await fetch(getAppSyncEndpoint(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idToken
        ? { Authorization: idToken }
        : { 'x-api-key': getAppSyncApiKey() }),
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new AppSyncError(
      `AppSync request failed (${response.status}): ${message || response.statusText}`
    )
  }

  const result = (await response.json()) as { data?: TData; errors?: unknown[] }

  if (result.errors && result.errors.length > 0) {
    throw new AppSyncError(
      `GraphQL errors: ${JSON.stringify(result.errors)}`,
      result.errors
    )
  }

  if (!result.data) {
    throw new AppSyncError('AppSync returned no data')
  }

  return result.data
}

/**
 * Execute a typed GraphQL operation against AppSync
 *
 * @param params - Execution parameters
 * @param params.document - Code-generated typed GraphQL document
 * @param params.variables - GraphQL variables (type-safe)
 * @param params.idToken - Optional Cognito token for user-specific queries
 * @returns Typed GraphQL response data
 * @throws {AppSyncError} On GraphQL errors or network failures
 */
export async function fetchGraphQL<TData, TVariables>(params: {
  document: TypedDocumentNode<TData, TVariables>
  variables?: TVariables
  idToken?: string
}): Promise<TData> {
  const { document, variables, idToken } = params
  return executeGraphQL({
    query: print(document),
    variables: variables as Record<string, unknown>,
    idToken,
  })
}

/**
 * Execute a raw GraphQL query string against AppSync
 *
 * Used by /api/graphql proxy route. Accepts raw strings from client.
 *
 * @param params - Execution parameters
 * @param params.query - Raw GraphQL query string
 * @param params.variables - Optional GraphQL variables
 * @param params.idToken - Optional Cognito token for user-specific queries
 * @returns Typed GraphQL response data
 */
export async function fetchGraphQLProxy<TData>(params: {
  query: string
  variables?: Record<string, unknown>
  idToken?: string
}): Promise<TData> {
  return executeGraphQL(params)
}
