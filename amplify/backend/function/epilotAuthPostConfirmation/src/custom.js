/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const https = require('https');

// Cache the API key to avoid fetching from SSM on every invocation
let cachedApiKey = null;

exports.handler = async (event) => {
  console.log('PostConfirmation trigger invoked', {
    triggerSource: event.triggerSource,
  });

  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    console.log('Skipping - not a ConfirmSignUp trigger');
    return event;
  }

  const email = event.request?.userAttributes?.email;
  const sub = event.request?.userAttributes?.sub;

  console.log('User attributes', { email, sub });

  if (!email || !sub) {
    console.error('Missing required user attributes');
    return event;
  }

  const username = email.split('@')[0] || email;
  const now = new Date().toISOString();

  const endpoint = process.env.APPSYNC_ENDPOINT;
  const apiKeyPath = process.env.APPSYNC_API_KEY_SSM_PATH;

  console.log('Environment config', {
    endpoint,
    apiKeyPath,
  });

  if (!endpoint || !apiKeyPath) {
    console.error('Missing APPSYNC_ENDPOINT or APPSYNC_API_KEY_SSM_PATH env var');
    return event;
  }

  // Get API key from SSM (cached after first fetch)
  const apiKey = await getApiKey(apiKeyPath);
  if (!apiKey) {
    console.error('Failed to retrieve API key from SSM');
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

  console.log('Creating UserState with input', input);

  try {
    const result = await makeAppSyncRequest({
      endpoint,
      apiKey,
      query: mutation,
      variables: { input },
    });
    console.log('Successfully created UserState', { sub, result });
  } catch (error) {
    console.error('PostConfirmation createUserState failed', {
      errorName: error.name,
      errorMessage: error.message,
    });
  }

  return event;
};

async function getApiKey(parameterPath) {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  try {
    const client = new SSMClient({ region: process.env.AWS_REGION });
    const command = new GetParameterCommand({
      Name: parameterPath,
      WithDecryption: true,
    });
    const response = await client.send(command);
    cachedApiKey = response.Parameter?.Value;
    console.log('API key retrieved from SSM successfully');
    return cachedApiKey;
  } catch (error) {
    console.error('Failed to get API key from SSM', {
      errorName: error.name,
      errorMessage: error.message,
    });
    return null;
  }
}

async function makeAppSyncRequest({ endpoint, apiKey, query, variables }) {
  const url = new URL(endpoint);
  const body = JSON.stringify({ query, variables });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log('Response received', {
            statusCode: res.statusCode,
            body: data.substring(0, 500),
          });

          try {
            const result = JSON.parse(data);
            if (result.errors && result.errors.length > 0) {
              console.error('AppSync errors', result.errors);
              reject(new Error(`AppSync error: ${JSON.stringify(result.errors)}`));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
