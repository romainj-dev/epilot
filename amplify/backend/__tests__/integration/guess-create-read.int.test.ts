/**
 * Integration test: Guess create + read (userPools owner auth)
 * 
 * Tests the real wiring:
 * - Cognito user creation and authentication
 * - AppSync Cognito (userPools) authorization
 * - Owner-based isolation
 * - createGuess + getGuess with owner field
 */

import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';
import { CognitoTestHelper } from './_helpers/cognito';

describe('Guess - create + read', () => {
  const config = getTestConfig();
  let cognitoHelper: CognitoTestHelper;

  beforeAll(() => {
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    );
  });

  it('should create and read a Guess via Cognito auth', async () => {
    const user = await cognitoHelper.createTestUser(
      `test-guess-${Date.now()}@example.com`,
      'TempPass123!'
    );

    try {
      const idToken = await cognitoHelper.getIdToken(user.username, user.password);

      // owner assertion: <sub>
      const expectedOwner = user.sub

      // User creates a Guess
      const now = new Date();
      const settleAt = new Date(now.getTime() + 60000);

      const createMutation = `
        mutation CreateGuess($input: CreateGuessInput!) {
          createGuess(input: $input) {
            id
            owner
            createdAt
            settleAt
            guessPrice
            startPrice
            status
          }
        }
      `;

      const createResult = await makeAppSyncRequest<{
        createGuess: {
          id: string;
          owner: string;
          createdAt: string;
          settleAt: string;
          guessPrice: number;
          startPrice: number;
          status: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: createMutation,
        variables: {
          input: {
            settleAt: settleAt.toISOString(),
            guessPrice: 99000.0,
            startPrice: 98500.0,
            status: 'PENDING',
          },
        },
      });
      console.log('createResult.createGuess.owner', createResult.createGuess.owner);
      expect(createResult.createGuess.id).toBeTruthy();
      expect(createResult.createGuess.owner).toBeTruthy();
      expect(createResult.createGuess.owner).toBe(expectedOwner);

      const guessId = createResult.createGuess.id;

      // User can read their own Guess
      const getQuery = `
        query GetGuess($id: ID!) {
          getGuess(id: $id) {
            id
            owner
            guessPrice
            startPrice
            status
          }
        }
      `;

      const getResult1 = await makeAppSyncRequest<{
        getGuess: {
          id: string;
          owner: string;
          guessPrice: number;
          startPrice: number;
          status: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken: idToken,
        query: getQuery,
        variables: { id: guessId },
      });

      expect(getResult1.getGuess.id).toBe(guessId);
      expect(getResult1.getGuess.owner).toBeTruthy();
      expect(getResult1.getGuess.owner).toBe(expectedOwner);
    } finally {
      await cognitoHelper.deleteUser(user.username);
    }
  });
});
