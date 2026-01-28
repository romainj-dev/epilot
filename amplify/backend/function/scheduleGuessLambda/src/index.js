const { SchedulerClient, CreateScheduleCommand } = require('@aws-sdk/client-scheduler')
const { logger } = require('lambda-utils')

const scheduler = new SchedulerClient({})

/**
 * DynamoDB Stream-triggered Lambda to create EventBridge Scheduler entries
 * for settling Bitcoin price guesses.
 * 
 * This Lambda is invoked when a new Guess is created (INSERT event). It:
 * 1. Filters for INSERT events with PENDING status
 * 2. Creates an EventBridge Scheduler entry to invoke settleGuessLambda at settleAt time
 * 3. Handles idempotency (schedule already exists)
 * 4. Throws errors for DDB Stream retry on unexpected failures
 * 
 * @param {Object} event - DynamoDB Stream event
 * @param {Array} event.Records - Array of DynamoDB stream records
 * @returns {Object} Processing stats for observability
 * @throws {Error} On unexpected failures (triggers DDB Stream retry)
 */
exports.handler = async (event) => {
  const startTime = Date.now()
  const records = Array.isArray(event?.Records) ? event.Records : []

  let recordsProcessed = 0
  let schedulesCreated = 0
  let schedulesSkipped = 0
  let recordsIgnored = 0

  for (const record of records) {
    if (record?.eventName !== 'INSERT') {
      recordsIgnored++
      continue
    }

    const newImage = record?.dynamodb?.NewImage
    if (!newImage) {
      recordsIgnored++
      continue
    }

    const guessId = newImage?.id?.S
    const settleAt = newImage?.settleAt?.S
    const status = newImage?.status?.S

    // Only schedule for PENDING guesses
    if (!guessId || !settleAt || status !== 'PENDING') {
      recordsIgnored++
      continue
    }

    recordsProcessed++

    try {
      await createSettlementSchedule({ guessId, settleAt })
      schedulesCreated++
      logger.info('Created settlement schedule', { guessId, settleAt })
    } catch (error) {
      // DDB Streams can retry; ensure idempotency when schedule already exists.
      // EventBridge Scheduler throws ConflictException on duplicate schedule name.
      if (
        error?.name === 'ConflictException' ||
        error?.name === 'ResourceAlreadyExistsException'
      ) {
        schedulesSkipped++
        logger.info('Settlement schedule already exists; skipping', { guessId })
        continue
      }
      
      // Unexpected error - log and re-throw for DDB Stream retry
      logger.error('Failed to create schedule', {
        guessId,
        errorName: error?.name,
        errorMessage: error?.message,
      })
      // Throwing here will fail the entire batch and trigger DDB Stream retry
      throw error
    }
  }

  const executionTimeMs = Date.now() - startTime
  const result = {
    success: true,
    totalRecords: records.length,
    recordsProcessed,
    recordsIgnored,
    schedulesCreated,
    schedulesSkipped,
    executionTimeMs,
  }

  logger.info('Batch processing completed', result)
  return result
}

async function createSettlementSchedule({ guessId, settleAt }) {
  const scheduleName = toScheduleName(guessId)
  const targetArn = process.env.SETTLE_GUESS_LAMBDA_ARN
  const roleArn = process.env.SCHEDULER_ROLE_ARN

  if (!targetArn || !roleArn) {
    throw new Error('Missing SETTLE_GUESS_LAMBDA_ARN or SCHEDULER_ROLE_ARN')
  }

  // EventBridge Scheduler `at()` doesn’t accept fractional seconds reliably; normalize to whole seconds.
  const settleAtIso = normalizeIsoToSeconds(settleAt)

  await scheduler.send(
    new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: 'guess-settlements',
      ScheduleExpression: `at(${settleAtIso})`,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      Target: {
        Arn: targetArn,
        RoleArn: roleArn,
        Input: JSON.stringify({ guessId }),
      },
      ActionAfterCompletion: 'DELETE'
    })
  )
}

function toScheduleName(guessId) {
  // Scheduler name constraints: [0-9A-Za-z-_.] and <= 64 chars
  const safe = String(guessId).replace(/[^0-9A-Za-z-_.]/g, '-')
  const name = `guess-settle-${safe}`
  return name.length <= 64 ? name : name.slice(0, 64)
}

function normalizeIsoToSeconds(isoString) {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) {
    // Fall back to raw; Scheduler will reject if invalid.
    return isoString
  }
  // EventBridge Scheduler `at()` expects `YYYY-MM-DDThh:mm:ss` (no millis, no `Z`),
  // and we already specify `ScheduleExpressionTimezone: UTC`.
  return d
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/Z$/, '')
}

