const fs = require('fs')
const path = require('path')

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function loadAmplifyConfig() {
  // Same path as config.ts, but resolved from repo root.
  return readJsonOrNull(
    path.join(process.cwd(), 'src', 'amplifyconfiguration.json')
  )
}

function loadAmplifyMeta() {
  return readJsonOrNull(
    path.join(process.cwd(), 'amplify', 'backend', 'amplify-meta.json')
  )
}

function resolveTestConfigPartials(env = process.env) {
  const amplifyConfig = loadAmplifyConfig()
  const amplifyMeta = loadAmplifyMeta()

  const region =
    env.AWS_REGION ||
    amplifyMeta?.providers?.awscloudformation?.Region ||
    amplifyConfig?.aws_project_region ||
    amplifyConfig?.aws_appsync_region

  const appsyncEndpoint =
    env.APPSYNC_ENDPOINT ||
    amplifyMeta?.api?.epilot?.output?.GraphQLAPIEndpointOutput ||
    amplifyConfig?.aws_appsync_graphqlEndpoint

  const appsyncApiKey =
    env.APPSYNC_API_KEY ||
    amplifyMeta?.api?.epilot?.output?.GraphQLAPIKeyOutput ||
    amplifyConfig?.aws_appsync_apiKey

  const cognitoUserPoolId =
    env.COGNITO_USER_POOL_ID ||
    amplifyMeta?.auth?.epilotAuth?.output?.UserPoolId ||
    amplifyConfig?.aws_user_pools_id

  const cognitoClientId =
    env.COGNITO_CLIENT_ID ||
    amplifyMeta?.auth?.epilotAuth?.output?.AppClientIDWeb ||
    amplifyConfig?.aws_user_pools_web_client_id

  const lambdaPostConfirmationArn =
    env.LAMBDA_POST_CONFIRMATION_ARN ||
    amplifyMeta?.function?.epilotAuthPostConfirmation?.output?.Arn

  const lambdaPriceSnapshotJobArn =
    env.LAMBDA_PRICE_SNAPSHOT_JOB_ARN ||
    amplifyMeta?.function?.priceSnapshotJob?.output?.Arn

  return {
    region,
    appsyncEndpoint,
    appsyncApiKey,
    cognitoUserPoolId,
    cognitoClientId,
    lambdaPostConfirmationArn,
    lambdaPriceSnapshotJobArn,
  }
}

module.exports = {
  readJsonOrNull,
  resolveTestConfigPartials,
}

