import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import {
  useQuery as useTanstackQuery,
  useMutation as useTanstackMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import type { OperationDefinitionNode } from 'graphql'

import { fetchGraphQLClient, type GraphQLError } from '@/lib/requests-client'

function getOperationName<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>
): string {
  const definition = document.definitions.find(
    (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
  )
  return definition?.name?.value ?? 'unknown'
}

export function useQuery<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
  options?: Omit<UseQueryOptions<TData, GraphQLError>, 'queryKey' | 'queryFn'>
) {
  const operationName = getOperationName(document)

  return useTanstackQuery<TData, GraphQLError>({
    queryKey: [operationName, variables],
    queryFn: () => fetchGraphQLClient(document, variables),
    ...options,
  })
}

export function useMutation<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  options?: Omit<
    UseMutationOptions<TData, GraphQLError, TVariables>,
    'mutationFn'
  >
) {
  return useTanstackMutation<TData, GraphQLError, TVariables>({
    mutationFn: (variables) => fetchGraphQLClient(document, variables),
    ...options,
  })
}
