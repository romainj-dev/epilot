/**
 * Integration test: PriceSnapshot CRUD operations (public API key auth)
 * 
 * Tests the real wiring:
 * - AppSync API key authentication
 * - createPriceSnapshot mutation
 * - deletePriceSnapshot mutation
 * - DynamoDB persistence via AppSync
 */

import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';
import { uniqueId } from './_helpers/naming';

describe('PriceSnapshot - CRUD operations', () => {
  const config = getTestConfig();
  let created: string[] = [];
  let seededSnapshotId: string;
  let seededPk: string;

  beforeEach(async () => {
    // Reset created array to ensure it doesn't grow between tests
    created = [];

    // Seed a PriceSnapshot via API key
    seededPk = uniqueId('PriceSnapshot-seed');
    const now = new Date().toISOString();

    const createSeedMutation = `
      mutation CreatePriceSnapshot($input: CreatePriceSnapshotInput!) {
        createPriceSnapshot(input: $input) {
          id
        }
      }
    `;

    const createResult = await makeAppSyncRequest<{
      createPriceSnapshot: { id: string };
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: createSeedMutation,
      variables: {
        input: {
          pk: seededPk,
          capturedAt: now,
          priceUsd: 50000.0,
          sourceUpdatedAt: now,
          source: 'test-seed',
        },
      },
    });

    seededSnapshotId = createResult.createPriceSnapshot.id;
    created.push(seededSnapshotId);
  });

  afterEach(async () => {
    // Best-effort cleanup via API key
    for (const id of created) {
      try {
        const deleteMutation = `
          mutation DeletePriceSnapshot($input: DeletePriceSnapshotInput!) {
            deletePriceSnapshot(input: $input) {
              id
            }
          }
        `;
        await makeAppSyncRequest({
          endpoint: config.appsyncEndpoint,
          apiKey: config.appsyncApiKey,
          query: deleteMutation,
          variables: { input: { id } },
        });
      } catch (err) {
        console.warn(`Failed to delete PriceSnapshot ${id}:`, err);
      }
    }
  });

  describe('createPriceSnapshot', () => {
    it('should create a PriceSnapshot via API key and return all selected fields', async () => {
      const now = new Date().toISOString();
      const pk = uniqueId('PriceSnapshot-create');

      const createMutation = `
        mutation CreatePriceSnapshot($input: CreatePriceSnapshotInput!) {
          createPriceSnapshot(input: $input) {
            id
            pk
            capturedAt
            sourceUpdatedAt
            priceUsd
            source
          }
        }
      `;

      const input = {
        pk,
        capturedAt: now,
        sourceUpdatedAt: now,
        priceUsd: 98765.43,
        source: 'test-integration',
      };

      const result = await makeAppSyncRequest<{
        createPriceSnapshot: {
          id: string;
          pk: string;
          capturedAt: string;
          sourceUpdatedAt: string | null;
          priceUsd: number;
          source: string | null;
        };
      }>({
        endpoint: config.appsyncEndpoint,
        apiKey: config.appsyncApiKey,
        query: createMutation,
        variables: { input },
      });

      // Server-set field
      expect(typeof result.createPriceSnapshot.id).toBe('string');
      expect(result.createPriceSnapshot.id).not.toBe('');

      expect(result.createPriceSnapshot).toMatchObject(input);

      created.push(result.createPriceSnapshot.id);
    });
  });

  describe('readPriceSnapshot', () => {
    it('should read a PriceSnapshot via API key and return the minimal selected fields', async () => {
      const getQuery = `
        query GetPriceSnapshot($id: ID!) {
          getPriceSnapshot(id: $id) {
            id
            pk
          }
        }
      `;

      const getResult = await makeAppSyncRequest<{
        getPriceSnapshot: { id: string; pk: string } | null;
      }>({
        endpoint: config.appsyncEndpoint,
        apiKey: config.appsyncApiKey,
        query: getQuery,
        variables: { id: seededSnapshotId },
      });

      expect(getResult.getPriceSnapshot).not.toBeNull();
      expect(getResult.getPriceSnapshot!.id).toBe(seededSnapshotId);
      expect(getResult.getPriceSnapshot!.pk).toBe(seededPk);
    });
  });
});
