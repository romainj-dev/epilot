/**
 * Shared naming utilities for integration tests.
 *
 * `runId` is generated once per Jest process (module init) and can be used to
 * namespace test data to avoid collisions across runs.
 */

export const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function uniqueId(prefix: string): string {
  // Include a per-call suffix so multiple entities created in the same run don't collide.
  return `${prefix}-${runId}-${Date.now()}`;
}

export function uniqueEmail(prefix: string): string {
  // Include a per-call suffix so multiple users in the same run don't collide.
  return `${prefix}-${runId}-${Date.now()}@example.com`;
}

