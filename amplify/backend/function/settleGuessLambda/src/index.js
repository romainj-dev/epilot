const { appsync, ssm, logger } = require('lambda-utils')

const { makeAppSyncRequest } = appsync

const PRICE_SNAPSHOT_PK = 'PriceSnapshot'

// Snapshot freshness configuration
// CoinGecko updates ~every 60s, so if gap >= 57s, a newer snapshot should exist
const FRESHNESS_THRESHOLD_MS = 57_000
const MAX_RETRIES = 4
const RETRY_DELAY_MS = 2_000

/**
 * EventBridge Scheduler-triggered Lambda to settle a user's Bitcoin price guess.
 * 
 * This Lambda is invoked by AWS EventBridge Scheduler at the settlement time
 * (typically 60 seconds after guess creation). It:
 * 1. Fetches the guess and validates it's PENDING
 * 2. Resolves start/end price snapshots
 * 3. Determines WIN/LOSS/DRAW outcome
 * 4. Updates guess status to SETTLED
 * 5. Updates user score (0 for DRAW, +1 for WIN, -1 for LOSS)
 * 
 * Error Handling Strategy:
 * - Unrecoverable errors (config issues, missing data): Returns error object (no retry)
 * - Transient errors (network issues, throttling): Throws error (allows retry)
 * 
 * @param {Object} event - EventBridge Scheduler event
 * @param {string} event.guessId - ID of the guess to settle
 * @returns {Object} Settlement result with status, outcome, and pricing details
 * @throws {Error} Only for transient failures where retry might succeed
 */
exports.handler = async (event) => {
  const startTime = Date.now()
  const guessId = event?.guessId

  if (!guessId) {
    // Don't throw: this lambda is typically invoked by EventBridge Scheduler;
    // throwing would cause retries for an unrecoverable payload issue.
    logger.error('Missing guessId in event', { event })
    return {
      success: false,
      reason: 'MISSING_GUESS_ID',
      executionTimeMs: Date.now() - startTime,
    }
  }

  const endpointPath = process.env.APPSYNC_ENDPOINT_SSM_PATH
  const apiKeyPath = process.env.APPSYNC_API_KEY_SSM_PATH

  if (!endpointPath || !apiKeyPath) {
    // Don't throw: configuration error is unrecoverable, retrying won't help
    logger.error('Configuration error - missing environment variables', { 
      endpointPath, 
      apiKeyPath,
    })
    return {
      success: false,
      reason: 'MISSING_ENV_VARS',
      executionTimeMs: Date.now() - startTime,
    }
  }

  const [endpoint, apiKey] = await Promise.all([
    ssm.getCachedParameterOrNull(endpointPath),
    ssm.getCachedParameterOrNull(apiKeyPath),
  ])

  if (!endpoint || !apiKey) {
    // Don't throw: SSM config error is unrecoverable, retrying won't help
    logger.error('Configuration error - failed to retrieve SSM parameters', {
      hasEndpoint: Boolean(endpoint),
      hasApiKey: Boolean(apiKey),
    })
    return {
      success: false,
      reason: 'SSM_PARAMS_NOT_FOUND',
      executionTimeMs: Date.now() - startTime,
    }
  }

  try {
    const guess = await fetchGuess({ endpoint, apiKey, guessId })
    if (!guess) {
      // Guess might have been deleted; log warning but don't throw
      // (scheduler will retry on throw, causing unnecessary retries)
      logger.warn('Guess not found, may have been deleted', { guessId })
      return {
        success: false,
        reason: 'GUESS_NOT_FOUND',
        guessId,
        executionTimeMs: Date.now() - startTime,
      }
    }

    if (guess.status !== 'PENDING') {
      // Already settled/failed, likely due to duplicate invocation
      logger.info('Guess already processed', {
        guessId,
        status: guess.status,
      })
      return {
        success: false,
        reason: 'ALREADY_PROCESSED',
        guessId,
        status: guess.status,
        executionTimeMs: Date.now() - startTime,
      }
    }

    const [startSnapshot, endSnapshot] = await Promise.all([
      resolveSnapshot({ endpoint, apiKey, targetTimestamp: guess.createdAt }),
      resolveEndSnapshot({ endpoint, apiKey, settleAt: guess.settleAt }),
    ])

    if (!startSnapshot || !endSnapshot) {
      logger.error('Failed to resolve snapshots', {
        guessId,
        hasStartSnapshot: Boolean(startSnapshot),
        hasEndSnapshot: Boolean(endSnapshot),
        guessCreatedAt: guess.createdAt,
        guessSettleAt: guess.settleAt,
      })
      await markGuessFailed({ endpoint, apiKey, guessId })
      return {
        success: false,
        reason: 'SNAPSHOTS_NOT_FOUND',
        guessId,
        status: 'FAILED',
        missingStartSnapshot: !startSnapshot,
        missingEndSnapshot: !endSnapshot,
        executionTimeMs: Date.now() - startTime,
      }
    }

    const startPrice = startSnapshot.priceUsd
    const endPrice = endSnapshot.priceUsd

    const actualDirection = endPrice === startPrice ? 'EQUAL' : endPrice > startPrice ? 'UP' : 'DOWN'
    const outcome = actualDirection === 'EQUAL' ? 'DRAW' : actualDirection === guess.direction ? 'WIN' :  'LOSS'
    const scoreDelta = outcome === 'DRAW' ? 0 : outcome === 'WIN' ? 1 :  -1

    await settleGuess({
      endpoint,
      apiKey,
      input: {
        id: guessId,
        startPriceSnapshotId: startSnapshot.id,
        endPriceSnapshotId: endSnapshot.id,
        startPrice,
        endPrice,
        result: actualDirection,
        outcome,
        status: 'SETTLED',
      },
    })

    await updateUserScore({
      endpoint,
      apiKey,
      ownerSub: guess.owner,
      scoreDelta,
    })

    const executionTimeMs = Date.now() - startTime

    logger.info('Guess settled successfully', { 
      guessId, 
      outcome, 
      scoreDelta,
      executionTimeMs,
    })

    return {
      success: true,
      guessId,
      status: 'SETTLED',
      outcome,
      direction: guess.direction,
      result: actualDirection,
      startPrice,
      endPrice,
      priceChange: endPrice - startPrice,
      priceChangePercent: ((endPrice - startPrice) / startPrice) * 100,
      scoreDelta,
      executionTimeMs,
    }
  } catch (error) {
    const executionTimeMs = Date.now() - startTime
    logger.error('Settlement failed', {
      guessId,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack,
      executionTimeMs,
    })
    throw error
  }
}

async function fetchGuess({ endpoint, apiKey, guessId }) {
  const query = `
    query GetGuess($id: ID!) {
      getGuess(id: $id) {
        id
        owner
        createdAt
        settleAt
        direction
        status
      }
    }
  `

  const res = await makeAppSyncRequest({
    endpoint,
    apiKey,
    query,
    variables: { id: guessId },
  })

  return res?.data?.getGuess ?? null
}

/**
 * Resolves the latest price snapshot BEFORE or AT the target timestamp.
 *
 * We use sourceUpdatedAt (when CoinGecko reported the price) to ensure
 * we get the price data that was actually available at the target time.
 *
 * Example timeline:
 *   T=0.000s  Our Lambda captures snapshot
 *   T=0.500s  User clicks "UP" (createdAt)
 *
 * For createdAt=T0.5, we want the snapshot from T0 (the latest before the click).
 */
async function resolveSnapshot({ endpoint, apiKey, targetTimestamp }) {
  const query = `
    query ResolveSnapshot(
      $pk: String!
      $sourceUpdatedAt: ModelStringKeyConditionInput!
      $limit: Int
    ) {
      priceSnapshotsBySourceUpdatedAt(
        pk: $pk
        sourceUpdatedAt: $sourceUpdatedAt
        sortDirection: DESC
        limit: $limit
      ) {
        items {
          id
          priceUsd
          sourceUpdatedAt
        }
      }
    }
  `

  const res = await makeAppSyncRequest({
    endpoint,
    apiKey,
    query,
    variables: {
      pk: PRICE_SNAPSHOT_PK,
      sourceUpdatedAt: { le: targetTimestamp },
      limit: 1,
    },
  })

  return res?.data?.priceSnapshotsBySourceUpdatedAt?.items?.[0] ?? null
}

/**
 * Resolves the end snapshot for settlement, handling the race condition where
 * the latest snapshot may not be written to DB yet.
 *
 * Edge case:
 *   T=0.000s  CoinGecko updates price P1 (sourceUpdatedAt: T=0s)
 *   T=0.500s  Lambda runs, fetches latest snapshot (P0, since P1 not stored yet)
 *   T=1.000s  P1 is stored in DB
 *
 * Solution:
 *   If settleAt - snapshot.sourceUpdatedAt >= 57s, a newer snapshot should exist
 *   (CoinGecko updates ~every 60s). Retry to wait for it to be written.
 *
 * @returns {Object|null} The resolved snapshot, or null if no fresh data available
 */
async function resolveEndSnapshot({ endpoint, apiKey, settleAt }) {
  const settleAtMs = new Date(settleAt).getTime()

  // First fetch
  const originalSnapshot = await resolveSnapshot({ endpoint, apiKey, targetTimestamp: settleAt })

  if (!originalSnapshot) {
    return null // No snapshot at all
  }

  const originalSourceMs = new Date(originalSnapshot.sourceUpdatedAt).getTime()
  const gapMs = settleAtMs - originalSourceMs

  // Fresh enough - no retry needed
  if (gapMs < FRESHNESS_THRESHOLD_MS) {
    return originalSnapshot
  }

  // Gap >= 57s - expect a newer snapshot soon, retry
  logger.info('End snapshot appears stale, waiting for newer data...', {
    settleAt,
    snapshotSourceUpdatedAt: originalSnapshot.sourceUpdatedAt,
    gapMs,
  })

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await sleep(RETRY_DELAY_MS)

    const newSnapshot = await resolveSnapshot({ endpoint, apiKey, targetTimestamp: settleAt })

    if (!newSnapshot) {
      continue // Shouldn't happen
    }

    // Check if we got a different (newer) snapshot
    if (newSnapshot.sourceUpdatedAt !== originalSnapshot.sourceUpdatedAt) {
      const newSourceMs = new Date(newSnapshot.sourceUpdatedAt).getTime()

      if (newSourceMs <= settleAtMs) {
        // New snapshot is valid for settlement
        logger.info('Newer snapshot found', {
          attempt,
          newSourceUpdatedAt: newSnapshot.sourceUpdatedAt,
        })
        return newSnapshot
      } else {
        // New snapshot is AFTER settleAt - use original
        logger.info('Newer snapshot is after settleAt, using original', {
          attempt,
          newSourceUpdatedAt: newSnapshot.sourceUpdatedAt,
          settleAt,
        })
        return originalSnapshot
      }
    }

    logger.info('No newer snapshot yet', { attempt })
  }

  // No new snapshot after retries - data pipeline issue
  logger.error('No fresh snapshot after retries, cannot settle reliably', {
    settleAt,
    lastSnapshotSourceUpdatedAt: originalSnapshot.sourceUpdatedAt,
  })

  return null // Caller will mark guess as FAILED
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function settleGuess({ endpoint, apiKey, input }) {
  // NOTE: avoid partial payloads breaking subscriptions by selecting all non-nullable fields.
  const safeMutation = `
    mutation SettleGuess($input: UpdateGuessInput!) {
      updateGuess(input: $input) {
        id
        owner
        createdAt
        settleAt
        direction
        startPriceSnapshotId
        endPriceSnapshotId
        startPrice
        endPrice
        status
        result
        outcome
        updatedAt
      }
    }
  `

  await makeAppSyncRequest({
    endpoint,
    apiKey,
    query: safeMutation,
    variables: { input },
  })
}

async function markGuessFailed({ endpoint, apiKey, guessId }) {
  const mutation = `
    mutation FailGuess($input: UpdateGuessInput!) {
      updateGuess(input: $input) {
        id
        owner
        createdAt
        settleAt
        direction
        status
        startPrice
        endPrice
        result
        outcome
        updatedAt
      }
    }
  `

  await makeAppSyncRequest({
    endpoint,
    apiKey,
    query: mutation,
    variables: { input: { id: guessId, status: 'FAILED' } },
  })
}

async function updateUserScore({ endpoint, apiKey, ownerSub, scoreDelta }) {
  if (!ownerSub) {
    logger.warn('Guess owner missing; skipping score update')
    return
  }

  // UserState id is the user's sub (created by PostConfirmation lambda).
  const getQuery = `
    query GetUserState($id: ID!) {
      getUserState(id: $id) {
        id
        score
      }
    }
  `

  const getRes = await makeAppSyncRequest({
    endpoint,
    apiKey,
    query: getQuery,
    variables: { id: ownerSub },
  })

  const userState = getRes?.data?.getUserState ?? null
  if (!userState) {
    logger.warn('UserState not found; skipping score update', { ownerSub })
    return
  }

  const mutation = `
    mutation UpdateScore($input: UpdateUserStateInput!) {
      updateUserState(input: $input) {
        id
        score
        lastUpdatedAt
      }
    }
  `

  await makeAppSyncRequest({
    endpoint,
    apiKey,
    query: mutation,
    variables: {
      input: {
        id: userState.id,
        score: (userState.score ?? 0) + scoreDelta,
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  })
}

