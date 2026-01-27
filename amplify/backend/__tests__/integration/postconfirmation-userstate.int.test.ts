/**
 * Integration test: PostConfirmation -> UserState insert
 * 
 * Tests the real wiring:
 * - Lambda invocation via AWS SDK
 * - epilotAuthPostConfirmation Lambda logic
 * - SSM parameter retrieval (AppSync endpoint + API key)
 * - AppSync createUserState mutation (with API key)
 * - DynamoDB persistence via AppSync
 * 
 * Strategy: Invoke the Lambda with a crafted Cognito PostConfirmation event
 * (no real Cognito user needed), then verify UserState was created via AppSync.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';
import { CognitoTestHelper } from './_helpers/cognito';

describe('PostConfirmation Lambda -> UserState', () => {
  const config = getTestConfig();
  let lambdaClient: LambdaClient;
  let cognitoHelper: CognitoTestHelper;

  beforeAll(() => {
    lambdaClient = new LambdaClient({ region: config.region });
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    );
  });

  it('should create UserState when PostConfirmation Lambda is invoked', async () => {
    if (!config.lambdaPostConfirmationArn) {
      throw new Error(
        'LAMBDA_POST_CONFIRMATION_ARN not configured. Set env var or ensure amplify-meta.json is present.'
      );
    }

    // Create a real Cognito user so we can read the created UserState via userPools auth
    const email = `test-postconfirm-${Date.now()}@example.com`;
    const user = await cognitoHelper.createTestUser(email, 'TempPass123!');
    const idToken = await cognitoHelper.getIdToken(user.username, user.password);
    const sub = user.sub;
    if (!sub) {
      throw new Error('Failed to resolve Cognito user sub');
    }

    // Craft a Cognito PostConfirmation trigger event
    const cognitoEvent = {
      version: '1',
      region: config.region,
      userPoolId: config.cognitoUserPoolId,
      userName: sub,
      triggerSource: 'PostConfirmation_ConfirmSignUp',
      request: {
        userAttributes: {
          sub,
          email,
          email_verified: 'true',
        },
      },
      response: {},
    };

    try {
      // Invoke the Lambda
      const invokeCommand = new InvokeCommand({
        FunctionName: config.lambdaPostConfirmationArn,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify(cognitoEvent)),
      });

      const lambdaResponse = await lambdaClient.send(invokeCommand);

      // Verify Lambda executed without errors
      expect(lambdaResponse.StatusCode).toBe(200);
      
      if (lambdaResponse.FunctionError) {
        const payload = lambdaResponse.Payload
          ? JSON.parse(Buffer.from(lambdaResponse.Payload).toString())
          : null;
        throw new Error(
          `Lambda execution failed: ${lambdaResponse.FunctionError}\n${JSON.stringify(payload, null, 2)}`
        );
      }

      // Query AppSync (Cognito auth) to verify UserState was created
      const query = `
        query GetUserState($id: ID!) {
          getUserState(id: $id) {
            id
            owner
            email
            username
            score
            streak
            lastUpdatedAt
          }
        }
      `;

      async function fetchUserState() {
        return await makeAppSyncRequest<{
          getUserState: {
            id: string;
            owner: string;
            email: string;
            username: string;
            score: number;
            streak: number;
            lastUpdatedAt: string;
          } | null;
        }>({
          endpoint: config.appsyncEndpoint,
          idToken,
          query,
          variables: { id: sub },
        });
      }

      async function waitForUserState(timeoutMs = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const res = await fetchUserState();
          if (res.getUserState) return res.getUserState;
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error('Timed out waiting for UserState to be created');
      }

      const userState = await waitForUserState();

      // Verify UserState was created with expected values
      expect(userState.id).toBe(sub);
      expect(userState.owner).toBe(sub);
      expect(userState.email).toBe(email);
      expect(userState.username).toBeTruthy(); // extracted from email
      expect(userState.score).toBe(0);
      expect(userState.streak).toBe(0);
      expect(userState.lastUpdatedAt).toBeTruthy();
    } finally {
      await cognitoHelper.deleteUser(user.username);
    }
  });
});
