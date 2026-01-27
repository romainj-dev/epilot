/**
 * Integration test: Guess CRUD operations (userPools owner auth)
 * 
 * Tests the real wiring:
 * - Cognito user creation and authentication
 * - AppSync Cognito (userPools) authorization
 * - Owner-based isolation
 * - createGuess, getGuess, updateGuess with explicit field assertions
 */

import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';
import { CognitoTestHelper } from './_helpers/cognito';
import { getGlobalTestUser } from './_helpers/global-user';

describe('Guess - CRUD operations', () => {
  let cognitoHelper: CognitoTestHelper;
  const config = getTestConfig();
  const globalUser = getGlobalTestUser();
  let created: string[] = [];

  let idToken: string;
let seededGuessId: string;
  
beforeAll(async () => {
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    );
  });

  beforeEach(async () => {
    // Refresh token to ensure it doesnt expire between tests
    idToken = await cognitoHelper.getIdToken(
        globalUser.username,
        globalUser.password
      );
    // Reset created array to ensure it doesnt grow between tests
    created = []

    // Seed a Guess
    const now = new Date();
    const settleAt = new Date(now.getTime() + 60000);

    const createMutation = `
      mutation CreateGuess($input: CreateGuessInput!) {
        createGuess(input: $input) {
          id
        }
      }
    `;

    const createResult = await makeAppSyncRequest<{
      createGuess: { id: string };
    }>({
      endpoint: config.appsyncEndpoint,
      idToken,
      query: createMutation,
      variables: {
        input: {
          settleAt: settleAt.toISOString(),
          guessPrice: 50000.0,
          startPrice: 49500.0,
          status: 'PENDING',
        },
      },
    });

    seededGuessId = createResult.createGuess.id;

    created.push(seededGuessId);
  });

  afterEach(async () => {
    // Best-effort cleanup via owner's idToken
    if (created.length > 0) {
        for (const id of created) {
            try {
                const deleteMutation = `
                  mutation DeleteGuess($input: DeleteGuessInput!) {
                    deleteGuess(input: $input) {
                      id
                    }
                  }
                `;
                await makeAppSyncRequest({
                  endpoint: config.appsyncEndpoint,
                  idToken,
                  query: deleteMutation,
                  variables: { input: { id } },
                });
              } catch (err) {
                console.warn(`Failed to delete Guess ${id}:`, err);
              }
        }
    }
  });

  describe('createGuess', () => {
    it('should create a Guess with all fields and return all selected fields', async () => {
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
              endPrice
              status
              result
            }
          }
        `;

        const input = {
          settleAt: settleAt.toISOString(),
          guessPrice: 99000.0,
          startPrice: 98500.0,
          status: 'PENDING',
          endPrice: null,
          result: null,
        };

        const createResult = await makeAppSyncRequest<{
          createGuess: {
            id: string;
            owner: string;
            createdAt: string;
            settleAt: string;
            guessPrice: number;
            startPrice: number;
            endPrice: number | null;
            status: string;
            result: string | null;
          };
        }>({
          endpoint: config.appsyncEndpoint,
          idToken,
          query: createMutation,
          variables: {
            input,
          },
        });

        expect(typeof createResult.createGuess.id).toBe('string');
        expect(createResult.createGuess.id).not.toBe('');
        expect(createResult.createGuess.owner).toBe(globalUser.sub);
        expect(typeof createResult.createGuess.createdAt).toBe('string');
        expect(new Date(createResult.createGuess.createdAt).getTime()).toBeGreaterThan(0);

        expect(createResult.createGuess).toMatchObject(input);

        created.push(createResult.createGuess.id);
    });
  });

  describe('readGuess', () => {
    it('should read a Guess and return all selected fields', async () => {
      const getQuery = `
        query GetGuess($id: ID!) {
          getGuess(id: $id) {
            id
            owner
          }
        }
      `;

      const getResult = await makeAppSyncRequest<{
        getGuess: {
          id: string;
          owner: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: getQuery,
        variables: { id: seededGuessId },
      });

      expect(getResult.getGuess.id).toBe(seededGuessId);
      expect(getResult.getGuess.owner).toBe(globalUser.sub);
    });
  });

  describe('updateGuess', () => {
    it('should update a Guess and return all selected fields', async () => {
      const updateMutation = `
        mutation UpdateGuess($input: UpdateGuessInput!) {
          updateGuess(input: $input) {
            id
            endPrice
            status
            result
          }
        }
      `;

      const input = {
        id: seededGuessId,
        endPrice: 61000.0,
        status: 'SETTLED',
        result: 'UP',
      };

      const updateResult = await makeAppSyncRequest<{
        updateGuess: {
          id: string;
          endPrice: number;
          status: string;
          result: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: updateMutation,
        variables: {
          input: {
            id: seededGuessId,
            endPrice: 61000.0,
            status: 'SETTLED',
            result: 'UP',
          },
        },
      });

      expect(updateResult.updateGuess).toMatchObject(input);
    });
  });
});
