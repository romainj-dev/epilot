export const GUESS_DURATION_MS = 60_000

/**
 * Pre-open buffer for guess settlement stream (ms)
 * Opens SSE connection this many ms before settleAt to ensure we catch the AppSync update
 */
export const GUESS_STREAM_PREOPEN_MS = 5_000
