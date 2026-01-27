/**
 * Integration test: priceSnapshotJob Lambda -> PriceSnapshot insert
 * 
 * Tests the real wiring:
 * - Lambda invocation via AWS SDK
 * - priceSnapshotJob Lambda logic
 * - SSM parameter retrieval (AppSync endpoint + API key)
 * - CoinGecko API call (real network call - accept flakiness)
 * - AppSync createPriceSnapshot mutation (with API key)
 * - DynamoDB persistence via AppSync
 * 
 * Strategy: Invoke the Lambda, then poll AppSync for the latest snapshot
 * and verify it was created with expected source/structure.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getTestConfig } from './_helpers/config';
import { makeAppSyncRequest } from './_helpers/appsync';

describe('priceSnapshotJob Lambda -> PriceSnapshot', () => {
  const config = getTestConfig();
  let lambdaClient: LambdaClient;

  beforeAll(() => {
    lambdaClient = new LambdaClient({ region: config.region });
  });

  it('should create a PriceSnapshot when priceSnapshotJob Lambda is invoked', async () => {
    if (!config.lambdaPriceSnapshotJobArn) {
      throw new Error(
        'LAMBDA_PRICE_SNAPSHOT_JOB_ARN not configured. Set env var or ensure amplify-meta.json is present.'
      );
    }

    const invocationStart = new Date();

    // Invoke the Lambda
    const invokeCommand = new InvokeCommand({
      FunctionName: config.lambdaPriceSnapshotJobArn,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({})),
    });

    const lambdaResponse = await lambdaClient.send(invokeCommand);

    // Verify Lambda executed without errors
    expect(lambdaResponse.StatusCode).toBe(200);

    const lambdaPayload = lambdaResponse.Payload
      ? JSON.parse(Buffer.from(lambdaResponse.Payload).toString())
      : null;

    if (lambdaResponse.FunctionError) {
      throw new Error(
        `Lambda execution failed: ${lambdaResponse.FunctionError}\n${JSON.stringify(lambdaPayload, null, 2)}`
      );
    }

    if (lambdaPayload && lambdaPayload.enabled === false) {
      console.warn('priceSnapshotJob is disabled; skipping snapshot assertion.');
      return;
    }

    // Query AppSync with API key for the latest snapshot
    const query = `
      query ListPriceSnapshots($pk: String!, $sortDirection: ModelSortDirection, $limit: Int) {
        priceSnapshotsByPk(pk: $pk, sortDirection: $sortDirection, limit: $limit) {
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

    async function fetchLatestSnapshot() {
      return await makeAppSyncRequest<{
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
        variables: {
          pk: 'PriceSnapshot',
          sortDirection: 'DESC',
          limit: 1,
        },
      });
    }

    async function waitForSnapshot(timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const res = await fetchLatestSnapshot();
        if (res.priceSnapshotsByPk.items.length > 0) {
          const snapshot = res.priceSnapshotsByPk.items[0];
          // Check if this snapshot was created after our invocation (allow 10s skew)
          const capturedAt = new Date(snapshot.capturedAt);
          const skewMs = 10000;
          if (capturedAt.getTime() >= invocationStart.getTime() - skewMs) {
            return snapshot;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error('Timed out waiting for PriceSnapshot to be created');
    }

    const snapshot = await waitForSnapshot();

    // Tolerant assertions (accept CoinGecko flakiness)
    expect(snapshot).toBeTruthy();
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.pk).toBe('PriceSnapshot');
    expect(snapshot.capturedAt).toBeTruthy();
    expect(new Date(snapshot.capturedAt).getTime()).toBeGreaterThan(0);
    
    // Verify price is a valid number
    expect(typeof snapshot.priceUsd).toBe('number');
    expect(snapshot.priceUsd).toBeGreaterThan(0);
    expect(Number.isFinite(snapshot.priceUsd)).toBe(true);
    
    // Verify source is coingecko
    expect(snapshot.source).toBe('coingecko');

    // Verify capturedAt is within a reasonable window (allow skew for network/async)
    const capturedAt = new Date(snapshot.capturedAt);
    const invocationEnd = new Date();
    const skewMs = 30000; // 30 seconds tolerance
    expect(capturedAt.getTime()).toBeGreaterThanOrEqual(invocationStart.getTime() - skewMs);
    expect(capturedAt.getTime()).toBeLessThanOrEqual(invocationEnd.getTime() + skewMs);

    console.log(`✓ priceSnapshotJob created snapshot: ${snapshot.id} with price ${snapshot.priceUsd}`);
  }, 30000); // 30s timeout for this test (network call + eventual consistency)
});
