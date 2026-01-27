/**
 * Integration test config loader
 * 
 * Precedence:
 * 1. Environment variables (primary source-of-truth)
 * 2. Amplify-generated config files (local convenience only)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TestConfig {
  region: string;
  appsyncEndpoint: string;
  appsyncApiKey: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  lambdaPostConfirmationArn?: string;
}

function loadAmplifyConfig() {
  try {
    const amplifyConfigPath = join(__dirname, '../../../../../src/amplifyconfiguration.json');
    return JSON.parse(readFileSync(amplifyConfigPath, 'utf-8'));
  } catch {
    return null;
  }
}

function loadAmplifyMeta() {
  try {
    // __dirname = amplify/backend/__tests__/integration/_helpers
    // meta lives at amplify/backend/amplify-meta.json
    const metaPath = join(__dirname, '../../../amplify-meta.json');
    return JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getTestConfig(): TestConfig {
  const amplifyConfig = loadAmplifyConfig();
  const amplifyMeta = loadAmplifyMeta();

  const region =
    process.env.AWS_REGION ||
    amplifyMeta?.providers?.awscloudformation?.Region ||
    amplifyConfig?.aws_project_region ||
    amplifyConfig?.aws_appsync_region;

  const appsyncEndpoint =
    process.env.APPSYNC_ENDPOINT ||
    amplifyMeta?.api?.epilot?.output?.GraphQLAPIEndpointOutput ||
    amplifyConfig?.aws_appsync_graphqlEndpoint;

  const appsyncApiKey =
    process.env.APPSYNC_API_KEY ||
    amplifyMeta?.api?.epilot?.output?.GraphQLAPIKeyOutput ||
    amplifyConfig?.aws_appsync_apiKey;

  const cognitoUserPoolId =
    process.env.COGNITO_USER_POOL_ID ||
    amplifyMeta?.auth?.epilotAuth?.output?.UserPoolId ||
    amplifyConfig?.aws_user_pools_id;

  const cognitoClientId =
    process.env.COGNITO_CLIENT_ID ||
    amplifyMeta?.auth?.epilotAuth?.output?.AppClientIDWeb ||
    amplifyConfig?.aws_user_pools_web_client_id;

  const lambdaPostConfirmationArn =
    process.env.LAMBDA_POST_CONFIRMATION_ARN ||
    amplifyMeta?.function?.epilotAuthPostConfirmation?.output?.Arn;

  if (!region || !appsyncEndpoint || !appsyncApiKey || !cognitoUserPoolId || !cognitoClientId) {
    throw new Error(
      'Missing required test config. Prefer env vars; otherwise ensure amplify/backend/amplify-meta.json exists.\n' +
      `  region: ${region ? '✓' : '✗'}\n` +
      `  appsyncEndpoint: ${appsyncEndpoint ? '✓' : '✗'}\n` +
      `  appsyncApiKey: ${appsyncApiKey ? '✓' : '✗'}\n` +
      `  cognitoUserPoolId: ${cognitoUserPoolId ? '✓' : '✗'}\n` +
      `  cognitoClientId: ${cognitoClientId ? '✓' : '✗'}\n`
    );
  }

  return {
    region,
    appsyncEndpoint,
    appsyncApiKey,
    cognitoUserPoolId,
    cognitoClientId,
    lambdaPostConfirmationArn,
  };
}
