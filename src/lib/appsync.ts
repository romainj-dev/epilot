type AppSyncResponse<T> = {
  data?: T
  errors?: unknown[]
}

const appSyncEndpoint = process.env.APPSYNC_ENDPOINT

if (!appSyncEndpoint) {
  throw new Error('Missing APPSYNC_ENDPOINT env var.')
}

const resolvedEndpoint: string = appSyncEndpoint

export async function callAppSync<T>({
  query,
  variables,
  idToken,
}: {
  query: string
  variables: Record<string, unknown>
  idToken: string
}): Promise<AppSyncResponse<T>> {
  const response = await fetch(resolvedEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: idToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      `AppSync request failed (${response.status}): ${message || response.statusText}`
    )
  }

  return (await response.json()) as AppSyncResponse<T>
}

export function getAppSyncEndpoint() {
  return resolvedEndpoint
}

export function assertAppSyncSuccess<T>(
  result: AppSyncResponse<T>,
  message: string
) {
  if (!result.errors || result.errors.length === 0) {
    return
  }
  throw new Error(`${message}: ${JSON.stringify(result.errors)}`)
}
