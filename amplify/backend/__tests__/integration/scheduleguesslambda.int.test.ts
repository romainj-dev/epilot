/**
 * Integration test: scheduleGuessLambda
 *
 * Keep it simple:
 * - Invoke the real Lambda with a synthetic DynamoDB Stream INSERT record
 * - Assert it executes successfully (no FunctionError)
 *
 * This validates wiring + permissions to create Scheduler schedules.
 * Unit tests cover parsing/idempotency details.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { getTestConfig } from './_helpers/config'

describe('scheduleGuessLambda', () => {
  const config = getTestConfig()
  let lambdaClient: LambdaClient

  beforeAll(() => {
    lambdaClient = new LambdaClient({ region: config.region })
  })

  it('should create a scheduler entry for an INSERT/PENDING guess stream record', async () => {
    if (!config.lambdaScheduleGuessArn) {
      throw new Error(
        'LAMBDA_SCHEDULE_GUESS_ARN not configured. Set env var or ensure amplify/backend/amplify-meta.json is present.'
      )
    }

    const guessId = `it-${Date.now()}`
    const settleAt = new Date(Date.now() + 15_000).toISOString()

    const event = {
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              id: { S: guessId },
              settleAt: { S: settleAt },
              status: { S: 'PENDING' },
            },
          },
        },
      ],
    }

    const invokeCommand = new InvokeCommand({
      FunctionName: config.lambdaScheduleGuessArn,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(event)),
    })

    const lambdaResponse = await lambdaClient.send(invokeCommand)
    expect(lambdaResponse.StatusCode).toBe(200)

    const lambdaPayload = lambdaResponse.Payload
      ? JSON.parse(Buffer.from(lambdaResponse.Payload).toString())
      : null

    if (lambdaResponse.FunctionError) {
      throw new Error(
        `Lambda execution failed: ${lambdaResponse.FunctionError}\n${JSON.stringify(lambdaPayload, null, 2)}`
      )
    }
  }, 30000)
})

