/**
 * Client-side GraphQL request handler
 *
 * Routes GraphQL operations through Next.js API route (/api/graphql) to avoid
 * exposing AppSync credentials to the browser. The API route handles authentication
 * and forwards requests to AppSync with the user's Cognito token.
 */

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print, type OperationDefinitionNode } from 'graphql'

function getOperationName<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>
): string | undefined {
  const definition = document.definitions.find(
    (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
  )
  return definition?.name?.value
}

/**
 * GraphQL-specific error with additional error details from the server
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    public readonly errors: unknown[]
  ) {
    super(message)
    this.name = 'GraphQLError'
  }
}

type GraphQLResponse<TData> = {
  data?: TData
  errors?: Array<{ message: string }>
}

/**
 * Execute a typed GraphQL operation via the Next.js API proxy
 *
 * Sends requests to /api/graphql which adds authentication and forwards to AppSync.
 * Used by React Query hooks for all client-side data fetching.
 *
 * @param document - Code-generated typed GraphQL document
 * @param variables - GraphQL variables (type-safe)
 * @returns Typed GraphQL response data
 * @throws {GraphQLError} On GraphQL errors or network failures
 */
export async function fetchGraphQLClient<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables
): Promise<TData> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operationName: getOperationName(document),
      query: print(document),
      variables,
    }),
  })

  if (!response.ok) {
    throw new GraphQLError(`HTTP error: ${response.status}`, [])
  }

  const result = (await response.json()) as GraphQLResponse<TData>

  if (result.errors && result.errors.length > 0) {
    throw new GraphQLError(
      result.errors.map((e) => e.message).join(', '),
      result.errors
    )
  }

  if (!result.data) {
    throw new GraphQLError('No data returned', [])
  }

  return result.data
}
