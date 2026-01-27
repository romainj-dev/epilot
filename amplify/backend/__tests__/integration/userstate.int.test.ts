/**
 * Integration test: UserState CRUD operations
 * 
 * Tests the real wiring:
 * - Create via API key (mirrors PostConfirmation Lambda flow)
 * - Read/update/delete via userPools owner auth
 * - Cognito user authentication
 * - AppSync authorization
 */

import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';
import { CognitoTestHelper } from './_helpers/cognito';
import { getGlobalTestUser } from './_helpers/global-user';

describe('UserState - CRUD operations', () => {
  const config = getTestConfig();
  let cognitoHelper: CognitoTestHelper;
  const globalUser = getGlobalTestUser();
  let idToken: string;
  let seededUserStateId: string;
  let created: string[] = [];

  beforeAll(async () => {
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    );
  });

  beforeEach(async () => {
    // Refresh token to ensure it doesn't expire between tests
    idToken = await cognitoHelper.getIdToken(globalUser.username, globalUser.password);

    // Reset created array to ensure it doesn't grow between tests
    created = [];

    const createSeedMutation = `
      mutation CreateUserState($input: CreateUserStateInput!) {
        createUserState(input: $input) {
          id
        }
      }
    `;

    const createResult = await makeAppSyncRequest<{
      createUserState: { id: string };
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: createSeedMutation,
      variables: {
        input: {
          owner: globalUser.sub,
          email: globalUser.email,
          username: globalUser.username,
          score: 0,
          streak: 0,
          lastUpdatedAt: new Date().toISOString(),
        },
      },
    });

    seededUserStateId = createResult.createUserState.id;
    created.push(seededUserStateId);
  });

  afterEach(async () => {
    // Best-effort cleanup via owner's idToken
    for (const id of created) {
      try {
        const deleteMutation = `
          mutation DeleteUserState($input: DeleteUserStateInput!) {
            deleteUserState(input: $input) {
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
        console.warn(`Failed to delete UserState ${id}:`, err);
      }
    }
  });

  describe('createUserState', () => {
    it('should create a UserState via API key and return all selected fields', async () => {

      const createMutation = `
        mutation CreateUserState($input: CreateUserStateInput!) {
          createUserState(input: $input) {
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

      const input = {
        owner: globalUser.sub,
        email: globalUser.email,
        username: globalUser.username,
        score: 0,
        streak: 0,
        lastUpdatedAt: new Date().toISOString(),
      };

      const createResult = await makeAppSyncRequest<{
        createUserState: {
          id: string;
          owner: string;
          email: string;
          username: string;
          score: number;
          streak: number;
          lastUpdatedAt: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        apiKey: config.appsyncApiKey,
        query: createMutation,
        variables: { input },
      });

      expect(typeof createResult.createUserState.id).toBe('string');
      expect(createResult.createUserState.id).not.toBe('');
      expect(createResult.createUserState.owner).toBe(globalUser.sub);
      
      expect(createResult.createUserState).toMatchObject(input);

      created.push(createResult.createUserState.id);
    });
  });

  describe('readUserState', () => {
    it('should read a UserState via userPools and return the minimal selected fields', async () => {
      const getQuery = `
        query GetUserState($id: ID!) {
          getUserState(id: $id) {
            id
            owner
          }
        }
      `;

      const getResult = await makeAppSyncRequest<{
        getUserState: { id: string; owner: string };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: getQuery,
        variables: { id: seededUserStateId },
      });

      expect(getResult.getUserState.id).toBe(seededUserStateId);
      expect(getResult.getUserState.owner).toBe(globalUser.sub);
    });
  });

  describe('updateUserState', () => {
    it('should update a UserState via userPools and return the minimal selected fields', async () => {
      const updateMutation = `
        mutation UpdateUserState($input: UpdateUserStateInput!) {
          updateUserState(input: $input) {
            id
            score
            streak
            lastUpdatedAt
          }
        }
      `;

      const input = {
        id: seededUserStateId,
        score: 15,
        streak: 3,
        lastUpdatedAt: new Date().toISOString(),
      };

      const updateResult = await makeAppSyncRequest<{
        updateUserState: {
          id: string;
          score: number;
          streak: number;
          lastUpdatedAt: string;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: updateMutation,
        variables: { input },
      });

      expect(updateResult.updateUserState).toMatchObject(input);
    });
  });
});
