/**
 * GraphQL data-fetching hooks
 *
 * Type-safe wrappers around React Query for GraphQL operations.
 * Provides automatic type inference from GraphQL documents and centralized error handling.
 */

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import {
  useQuery as useTanstackQuery,
  useMutation as useTanstackMutation,
  useInfiniteQuery as useTanstackInfiniteQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions,
  type InfiniteData,
} from '@tanstack/react-query'
import type { OperationDefinitionNode } from 'graphql'

import { fetchGraphQLClient, type GraphQLError } from '@/lib/requests-client'
import { type QueryKey } from '@/lib/query-keys'

// Re-export TanStack Query utilities for consistent imports
export { useQueryClient, type InfiniteData }

function getOperationName<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>
): string {
  const definition = document.definitions.find(
    (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition'
  )
  return definition?.name?.value ?? 'unknown'
}

/**
 * Hook for GraphQL queries with flexible query key support and data transformation.
 *
 * @template TQueryFnData - The raw GraphQL query response data type
 * @template TVariables - The query variables type
 * @template TData - The transformed data type (defaults to TQueryFnData)
 *
 * @example
 * // With auto-generated query key
 * const query = useQuery(MyDocument, { id: '123' })
 *
 * @example
 * // With custom query key and data transformation
 * const query = useQuery(MyDocument, { id: '123' }, {
 *   queryKey: queryKeys.myResource.get('123'),
 *   select: (data) => data.items[0],
 *   staleTime: Infinity,
 * })
 */
export function useQuery<TQueryFnData, TVariables, TData = TQueryFnData>(
  document: TypedDocumentNode<TQueryFnData, TVariables>,
  variables?: TVariables,
  options?: Omit<
    UseQueryOptions<TQueryFnData, GraphQLError, TData>,
    'queryFn' | 'queryKey' // We provide these
  > & {
    queryKey?: QueryKey // Narrow to our typed query keys
  }
) {
  const operationName = getOperationName(document)
  const { queryKey, ...restOptions } = options ?? {}

  return useTanstackQuery<TQueryFnData, GraphQLError, TData>({
    queryKey: queryKey ?? [operationName, variables],
    queryFn: () => fetchGraphQLClient(document, variables),
    ...restOptions,
  })
}

/**
 * Hook for GraphQL infinite queries with pagination support and data transformation.
 *
 * @template TQueryFnData - The raw GraphQL query response data type
 * @template TVariables - The query variables type
 * @template TData - The transformed data type (defaults to InfiniteData<TQueryFnData>)
 * @template TPageParam - The page parameter type (e.g., nextToken string)
 *
 * @example
 * // Basic infinite query with nextToken pagination
 * const query = useInfiniteQuery(
 *   MyDocument,
 *   {
 *     queryKey: queryKeys.items.list(),
 *     getVariables: (pageParam) => ({
 *       limit: 20,
 *       nextToken: pageParam,
 *     }),
 *     getNextPageParam: (lastPage) => lastPage.items?.nextToken,
 *     initialPageParam: undefined,
 *   }
 * )
 *
 * @example
 * // With data transformation using select
 * const query = useInfiniteQuery(
 *   MyDocument,
 *   {
 *     queryKey: queryKeys.items.list(),
 *     getVariables: (pageParam) => ({ limit: 20, nextToken: pageParam }),
 *     getNextPageParam: (lastPage) => lastPage.items?.nextToken,
 *     initialPageParam: undefined,
 *     select: (data) => data.pages.flatMap(page => page.items),
 *   }
 * )
 */
export function useInfiniteQuery<
  TQueryFnData,
  TVariables,
  TData = InfiniteData<TQueryFnData>,
  TPageParam = unknown,
>(
  document: TypedDocumentNode<TQueryFnData, TVariables>,
  options: Omit<
    UseInfiniteQueryOptions<
      TQueryFnData,
      GraphQLError,
      TData,
      QueryKey,
      TPageParam
    >,
    'queryFn' | 'queryKey' // We provide queryFn; queryKey is narrowed below
  > & {
    queryKey: QueryKey // Narrow to our typed query keys
    getVariables: (pageParam: TPageParam) => TVariables // Custom helper for pagination
  }
) {
  const { getVariables, ...restOptions } = options

  return useTanstackInfiniteQuery<
    TQueryFnData,
    GraphQLError,
    TData,
    QueryKey,
    TPageParam
  >({
    queryFn: ({ pageParam }) =>
      fetchGraphQLClient(document, getVariables(pageParam as TPageParam)),
    ...restOptions,
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
