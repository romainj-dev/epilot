import 'server-only'

/**
 * Centralized, reusable environment variable helpers.
 *
 * We keep these helpers "lazy" (they throw only when called) so modules can be
 * imported in unit tests without requiring a fully populated env.
 *
 * TODO improve with zod schema + runtime validation
 */

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} env var.`)
  }
  return value
}

export function getAwsRegion(): string {
  return requireEnv('AWS_REGION')
}

export function getCognitoClientId(): string {
  return requireEnv('COGNITO_CLIENT_ID')
}

export function getAppSyncEndpoint(): string {
  return requireEnv('APPSYNC_ENDPOINT')
}

export function getAppSyncApiKey(): string {
  return requireEnv('APPSYNC_API_KEY')
}

export function getAuthSecret(): string {
  return requireEnv('AUTH_SECRET')
}
