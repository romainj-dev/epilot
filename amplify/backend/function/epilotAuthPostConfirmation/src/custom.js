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

  const endpoint = process.env.APPSYNC_ENDPOINT;
  const apiKeyPath = process.env.APPSYNC_API_KEY_SSM_PATH;

  logger.info('Environment config', {
    endpoint,
    apiKeyPath,
  });

  if (!endpoint || !apiKeyPath) {
    logger.error('Missing APPSYNC_ENDPOINT or APPSYNC_API_KEY_SSM_PATH env var');
    return event;
  }

  // Get API key from SSM (cached after first fetch)
  const apiKey = await ssm.getCachedParameterOrNull(apiKeyPath);
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

