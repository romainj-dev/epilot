/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
const { appsync, ssm, logger } = require('lambda-utils');

exports.handler = async (event) => {
  logger.info('PostConfirmation trigger invoked', {
    triggerSource: event.triggerSource,
  });

  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    logger.info('Skipping - not a ConfirmSignUp trigger');
    return event;
  }

  const email = event.request?.userAttributes?.email;
  const sub = event.request?.userAttributes?.sub;

  logger.info('User attributes', { email, sub });

  if (!email || !sub) {
    logger.error('Missing required user attributes');
    return event;
  }

  const username = email.split('@')[0] || email;
  const now = new Date().toISOString();

  const endpointPath = process.env.APPSYNC_ENDPOINT_SSM_PATH;
  const apiKeyPath = process.env.APPSYNC_API_KEY_SSM_PATH;

  logger.info('Environment config', {
    endpointPath,
    apiKeyPath,
  });

  if (!endpointPath || !apiKeyPath) {
    logger.error('Missing APPSYNC_ENDPOINT_SSM_PATH or APPSYNC_API_KEY_SSM_PATH env var');
    return event;
  }

  // Get endpoint and API key from SSM (cached after first fetch)
  const [endpoint, apiKey] = await Promise.all([
    ssm.getCachedParameterOrNull(endpointPath),
    ssm.getCachedParameterOrNull(apiKeyPath),
  ]);

  if (!endpoint) {
    logger.error('Failed to retrieve AppSync endpoint from SSM');
    return event;
  }

  if (!apiKey) {
    logger.error('Failed to retrieve API key from SSM');
    return event;
  }

  const mutation = `
    mutation CreateUserState($input: CreateUserStateInput!) {
      createUserState(input: $input) {
        id
      }
    }
  `;

  const input = {
    id: sub,
    owner: sub,
    email,
    username,
    score: 0,
    streak: 0,
    lastUpdatedAt: now,
  };

  logger.info('Creating UserState with input', input);

  try {
    const result = await appsync.makeAppSyncRequest({
      endpoint,
      apiKey,
      query: mutation,
      variables: { input },
      onResponse: ({ statusCode, body }) => {
        logger.info('Response received', {
          statusCode,
          body: body.substring(0, 500),
        });
      },
    });
    logger.info('Successfully created UserState', { sub, result });
  } catch (error) {
    logger.error('PostConfirmation createUserState failed', {
      errorName: error.name,
      errorMessage: error.message,
    });
  }

  return event;
};

