/**
 * AppSync helper for integration tests.
 * Reuse `lambda-utils/appsync` so this test suite also exercises the shared helper.
 */

interface AppSyncRequestOptions {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  apiKey?: string;
  idToken?: string;
}

export async function makeAppSyncRequest<T = unknown>(
  options: AppSyncRequestOptions
): Promise<T> {
  const { endpoint, query, variables, apiKey, idToken } = options;

  if (!apiKey && !idToken) {
    throw new Error('Either apiKey or idToken must be provided');
  }

  const { makeAppSyncRequest: makeAppSyncRequestUtils } = require('lambda-utils/appsync') as {
    makeAppSyncRequest: (args: {
      endpoint: string;
      apiKey?: string;
      idToken?: string;
      query: string;
      variables?: Record<string, unknown>;
    }) => Promise<unknown>;
  };

  const result = await makeAppSyncRequestUtils({
    endpoint,
    apiKey,
    idToken,
    query,
    variables,
  });

  // lambda-utils returns { data, errors } shape; we standardize on returning `data`.
  if (typeof result === 'object' && result !== null && 'data' in result) {
    return (result as { data: unknown }).data as T;
  }
  return result as T;
}
