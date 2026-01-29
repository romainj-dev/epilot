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

/**
 * Hook for GraphQL mutations with optional context type for optimistic updates.
 *
 * @template TData - The mutation response data type
 * @template TVariables - The mutation variables type
 * @template TContext - Optional context type for onMutate callback (defaults to unknown)
 *
 * @example
 * // With typed context for optimistic updates
 * interface MyContext { previousData: SomeType }
 * const mutation = useMutation<MutationData, MutationVars, MyContext>(
 *   MyDocument,
 *   {
 *     onMutate: async (vars): Promise<MyContext> => ({ previousData: ... }),
 *     onError: (err, vars, context) => {
 *       // context is typed as MyContext
 *     }
 *   }
 * )
 */
export function useMutation<TData, TVariables, TContext = unknown>(
  document: TypedDocumentNode<TData, TVariables>,
  options?: Omit<
    UseMutationOptions<TData, GraphQLError, TVariables, TContext>,
    'mutationFn'
  >
) {
  return useTanstackMutation<TData, GraphQLError, TVariables, TContext>({
    mutationFn: (variables) => fetchGraphQLClient(document, variables),
    ...options,
  })
}
