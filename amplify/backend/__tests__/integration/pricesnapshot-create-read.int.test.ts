/**
 * Integration test: PriceSnapshot create + read (public API key auth)
 * 
 * Tests the real wiring:
 * - AppSync API key authentication
 * - createPriceSnapshot mutation
 * - DynamoDB persistence via AppSync
 */

import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';

describe('PriceSnapshot - create + read', () => {
  const config = getTestConfig();

  it('should create and query a PriceSnapshot via API key', async () => {
    const now = new Date().toISOString();
    const priceUsd = 98765.43;

    const mutation = `
      mutation CreatePriceSnapshot($input: CreatePriceSnapshotInput!) {
        createPriceSnapshot(input: $input) {
          id
          pk
          capturedAt
          priceUsd
          sourceUpdatedAt
          source
        }
      }
    `;

    const variables = {
      input: {
        pk: 'PriceSnapshot',
        capturedAt: now,
        priceUsd,
        sourceUpdatedAt: now,
        source: 'test-integration',
      },
    };

    const result = await makeAppSyncRequest<{
      createPriceSnapshot: {
        id: string;
        pk: string;
        capturedAt: string;
        priceUsd: number;
        sourceUpdatedAt: string;
        source: string;
      };
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: mutation,
      variables,
    });

    expect(result.createPriceSnapshot).toBeDefined();
    expect(result.createPriceSnapshot.id).toBeTruthy();
    expect(result.createPriceSnapshot.pk).toBe('PriceSnapshot');
    expect(result.createPriceSnapshot.capturedAt).toBe(now);
    expect(result.createPriceSnapshot.priceUsd).toBe(priceUsd);
    expect(result.createPriceSnapshot.sourceUpdatedAt).toBe(now);
    expect(result.createPriceSnapshot.source).toBe('test-integration');

    const query = `
      query ListPriceSnapshots($pk: String!, $capturedAt: ModelStringKeyConditionInput) {
        priceSnapshotsByPk(pk: $pk, capturedAt: $capturedAt, sortDirection: DESC, limit: 1) {
          items {
            id
            pk
            capturedAt
            priceUsd
            sourceUpdatedAt
            source
          }
        }
      }
    `;

    const queryResult = await makeAppSyncRequest<{
      priceSnapshotsByPk: {
        items: Array<{
          id: string;
          pk: string;
          capturedAt: string;
          priceUsd: number;
          sourceUpdatedAt: string | null;
          source: string | null;
        }>;
      };
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query,
      variables: { pk: 'PriceSnapshot', capturedAt: { eq: now } },
    });

    expect(queryResult.priceSnapshotsByPk).toBeDefined();
    expect(queryResult.priceSnapshotsByPk.items).toBeInstanceOf(Array);
    expect(queryResult.priceSnapshotsByPk.items.length).toBeGreaterThan(0);
    
    const snapshot = queryResult.priceSnapshotsByPk.items[0];
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.pk).toBe('PriceSnapshot');
    expect(snapshot.capturedAt).toBe(now);
    expect(snapshot.priceUsd).toBe(priceUsd);
    expect(snapshot.sourceUpdatedAt).toBe(now);
    expect(snapshot.source).toBe('test-integration');
  });
});
