/**
 * Integration test config loader
 * 
 * Precedence:
 * 1. Environment variables (primary source-of-truth)
 * 2. Amplify-generated config files (local convenience only)
 */


interface TestConfig {
  region: string;
  appsyncEndpoint: string;
  appsyncApiKey: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  lambdaPostConfirmationArn?: string;
  lambdaPriceSnapshotJobArn?: string;
  lambdaSettleGuessArn?: string;
  lambdaScheduleGuessArn?: string;
}

export function getTestConfig(): TestConfig {
  const { resolveTestConfigPartials } = require('./config.shared.js') as {
    resolveTestConfigPartials: () => {
      region?: string;
      appsyncEndpoint?: string;
      appsyncApiKey?: string;
      cognitoUserPoolId?: string;
      cognitoClientId?: string;
      lambdaPostConfirmationArn?: string;
      lambdaPriceSnapshotJobArn?: string;
      lambdaSettleGuessArn?: string;
      lambdaScheduleGuessArn?: string;
    };
  };

  const {
    region,
    appsyncEndpoint,
    appsyncApiKey,
    cognitoUserPoolId,
    cognitoClientId,
    lambdaPostConfirmationArn,
    lambdaPriceSnapshotJobArn,
    lambdaSettleGuessArn,
    lambdaScheduleGuessArn,
  } = resolveTestConfigPartials();

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
    lambdaPriceSnapshotJobArn,
    lambdaSettleGuessArn,
    lambdaScheduleGuessArn,
  };
}
