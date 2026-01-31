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
