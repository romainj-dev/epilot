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
 * Execute a typed GraphQL document against AppSync.
 * Use this for server-side code with generated documents.
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
 * Execute a raw GraphQL query string against AppSync.
 * Use this for the GraphQL proxy route.
 */
export async function fetchGraphQLProxy<TData>(params: {
  query: string
  variables?: Record<string, unknown>
  idToken?: string
}): Promise<TData> {
  return executeGraphQL(params)
}
