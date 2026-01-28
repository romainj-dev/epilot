/**
 * Integration test: settleGuessLambda
 *
 * Keep it simple:
 * - Create a guess as a Cognito user (owner auth)
 * - Seed 2 PriceSnapshots via apiKey so settlement can resolve start/end prices
 * - Invoke the real Lambda via AWS SDK
 * - Verify guess becomes SETTLED and user score increments (+1)
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { getTestConfig } from './_helpers/config'
import { makeAppSyncRequest } from './_helpers/appsync'
import { CognitoTestHelper } from './_helpers/cognito'
import { getGlobalTestUser } from './_helpers/global-user'

describe('settleGuessLambda', () => {
  const config = getTestConfig()
  const globalUser = getGlobalTestUser()

  let cognitoHelper: CognitoTestHelper
  let lambdaClient: LambdaClient
  let idToken: string

  const createdGuessIds: string[] = []
  const createdSnapshotIds: string[] = []

  beforeAll(async () => {
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    )
    lambdaClient = new LambdaClient({ region: config.region })
  })

  beforeEach(async () => {
    idToken = await cognitoHelper.getIdToken(
      globalUser.username,
      globalUser.password
    )
  })

  afterEach(async () => {
    // Best-effort cleanup
    for (const id of createdGuessIds.splice(0)) {
      try {
        const deleteMutation = `
          mutation DeleteGuess($input: DeleteGuessInput!) {
            deleteGuess(input: $input) { id }
          }
        `
        await makeAppSyncRequest({
          endpoint: config.appsyncEndpoint,
          idToken,
          query: deleteMutation,
          variables: { input: { id } },
        })
      } catch (err) {
        console.warn(`Failed to delete Guess ${id}:`, err)
      }
    }

    for (const id of createdSnapshotIds.splice(0)) {
      try {
        const deleteMutation = `
          mutation DeletePriceSnapshot($input: DeletePriceSnapshotInput!) {
            deletePriceSnapshot(input: $input) { id }
          }
        `
        await makeAppSyncRequest({
          endpoint: config.appsyncEndpoint,
          apiKey: config.appsyncApiKey,
          query: deleteMutation,
          variables: { input: { id } },
        })
      } catch (err) {
        console.warn(`Failed to delete PriceSnapshot ${id}:`, err)
      }
    }
  })

  it('should settle a guess and increment user score', async () => {
    if (!config.lambdaSettleGuessArn) {
      throw new Error(
        'LAMBDA_SETTLE_GUESS_ARN not configured. Set env var or ensure amplify/backend/amplify-meta.json is present.'
      )
    }

    // Read initial score (apiKey allowed for settlement/testing).
    const getUserStateQuery = `
      query GetUserState($id: ID!) {
        getUserState(id: $id) { 
          id 
          score 
          lastUpdatedAt
        }
      }
    `

    const beforeUserState = await makeAppSyncRequest<{
      getUserState: { id: string; score: number; lastUpdatedAt: string }
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: getUserStateQuery,
      variables: { id: globalUser.sub },
    })

    if (!beforeUserState.getUserState) {
      throw new Error('Expected UserState to exist for global test user')
    }

    const beforeScore = beforeUserState.getUserState.score

    // Create guess (choose direction UP; we will seed snapshots that go up so outcome = WIN).
    const settleAt = new Date(Date.now() + 15_000).toISOString()
    const createGuessMutation = `
      mutation CreateGuess($input: CreateGuessInput!) {
        createGuess(input: $input) {
          id
          owner
          createdAt
          settleAt
          direction
          status
        }
      }
    `

    const createdGuess = await makeAppSyncRequest<{
      createGuess: {
        id: string
        owner: string
        createdAt: string
        settleAt: string
        direction: string
        status: string
      }
    }>({
      endpoint: config.appsyncEndpoint,
      idToken,
      query: createGuessMutation,
      variables: {
        input: { settleAt, direction: 'UP', status: 'PENDING' },
      },
    })

    const guess = createdGuess.createGuess
    createdGuessIds.push(guess.id)

    // Seed snapshots BEFORE the target times.
    // The settlement logic finds the latest snapshot with sourceUpdatedAt <= targetTimestamp.
    // This simulates real-world: price data is available BEFORE the user clicks/settles.
    const startSnapTime = new Date(new Date(guess.createdAt).getTime() - 1000).toISOString()
    const endSnapTime = new Date(new Date(guess.settleAt).getTime() - 1000).toISOString()

    const createSnapshotMutation = `
      mutation CreatePriceSnapshot($input: CreatePriceSnapshotInput!) {
        createPriceSnapshot(input: $input) {
          id
        }
      }
    `

    const startSnapshot = await makeAppSyncRequest<{
      createPriceSnapshot: { id: string }
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: createSnapshotMutation,
      variables: {
        input: {
          pk: 'PriceSnapshot',
          capturedAt: new Date().toISOString(),
          sourceUpdatedAt: startSnapTime,
          priceUsd: 100,
          source: 'test',
        },
      },
    })
    createdSnapshotIds.push(startSnapshot.createPriceSnapshot.id)

    const endSnapshot = await makeAppSyncRequest<{
      createPriceSnapshot: { id: string }
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: createSnapshotMutation,
      variables: {
        input: {
          pk: 'PriceSnapshot',
          capturedAt: new Date().toISOString(),
          sourceUpdatedAt: endSnapTime,
          priceUsd: 110,
          source: 'test',
        },
      },
    })
    createdSnapshotIds.push(endSnapshot.createPriceSnapshot.id)

    // Invoke lambda
    const invokeCommand = new InvokeCommand({
      FunctionName: config.lambdaSettleGuessArn,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ guessId: guess.id })),
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

    // Verify guess settled
    const getGuessQuery = `
      query GetGuess($id: ID!) {
        getGuess(id: $id) {
          id
          status
          result
          outcome
          startPrice
          endPrice
        }
      }
    `

    const getGuess = await makeAppSyncRequest<{
      getGuess: {
        id: string
        status: string
        result: string | null
        outcome: string | null
        startPrice: number | null
        endPrice: number | null
      }
    }>({
      endpoint: config.appsyncEndpoint,
      idToken,
      query: getGuessQuery,
      variables: { id: guess.id },
    })

    expect(getGuess.getGuess.id).toBe(guess.id)
    expect(getGuess.getGuess.status).toBe('SETTLED')
    expect(getGuess.getGuess.result).toBe('UP')
    expect(getGuess.getGuess.outcome).toBe('WIN')
    expect(getGuess.getGuess.startPrice).toBe(100)
    expect(getGuess.getGuess.endPrice).toBe(110)

    // Verify score increment (+1 for WIN)
    const afterUserState = await makeAppSyncRequest<{
      getUserState: { id: string; score: number; lastUpdatedAt: string }
    }>({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: getUserStateQuery,
      variables: { id: globalUser.sub },
    })

    expect(afterUserState.getUserState.score).toBe(beforeScore + 1)

    // Restore score to keep test environment stable.
    const restoreMutation = `
      mutation RestoreScore($input: UpdateUserStateInput!) {
        updateUserState(input: $input) { id score lastUpdatedAt }
      }
    `
    await makeAppSyncRequest({
      endpoint: config.appsyncEndpoint,
      apiKey: config.appsyncApiKey,
      query: restoreMutation,
      variables: {
        input: {
          id: globalUser.sub,
          score: beforeScore,
          lastUpdatedAt: new Date().toISOString(),
        },
      },
    })
  }, 30000)
})

