/**
 * Integration test: Guess CRUD operations (userPools owner auth)
 *
 * Tests the real wiring:
 * - Cognito user creation and authentication
 * - AppSync Cognito (userPools) authorization
 * - Owner-based isolation
 * - createGuess, getGuess, updateGuess with explicit field assertions
 */

import { getTestConfig } from './_helpers/config'
import { makeAppSyncRequest } from './_helpers/appsync'
import { CognitoTestHelper } from './_helpers/cognito'
import { getGlobalTestUser } from './_helpers/global-user'

describe('Guess - CRUD operations', () => {
  let cognitoHelper: CognitoTestHelper
  const config = getTestConfig()
  const globalUser = getGlobalTestUser()
  let created: string[] = []

  let idToken: string
  let seededGuessId: string

  beforeAll(async () => {
    cognitoHelper = new CognitoTestHelper(
      config.region,
      config.cognitoUserPoolId,
      config.cognitoClientId
    )
  })

  beforeEach(async () => {
    // Refresh token to ensure it doesnt expire between tests
    idToken = await cognitoHelper.getIdToken(
      globalUser.username,
      globalUser.password
    )
    // Reset created array to ensure it doesnt grow between tests
    created = []

    // Seed a Guess
    const now = new Date()
    const settleAt = new Date(now.getTime() + 60000)

    const createMutation = `
      mutation CreateGuess($input: CreateGuessInput!) {
        createGuess(input: $input) {
          id
        }
      }
    `

    const createResult = await makeAppSyncRequest<{
      createGuess: { id: string }
    }>({
      endpoint: config.appsyncEndpoint,
      idToken,
      query: createMutation,
      variables: {
        input: {
          settleAt: settleAt.toISOString(),
          direction: 'UP',
          status: 'PENDING',
        },
      },
    })

    seededGuessId = createResult.createGuess.id

    created.push(seededGuessId)
  })

  afterEach(async () => {
    // Best-effort cleanup via owner's idToken
    if (created.length > 0) {
      for (const id of created) {
        try {
          const deleteMutation = `
            mutation DeleteGuess($input: DeleteGuessInput!) {
              deleteGuess(input: $input) {
                id
              }
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
    }
  })

  describe('createGuess', () => {
    it('should create a Guess with required fields and return all selected fields', async () => {
      const now = new Date()
      const settleAt = new Date(now.getTime() + 60000)

      const createMutation = `
        mutation CreateGuess($input: CreateGuessInput!) {
          createGuess(input: $input) {
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
          }
        }
      `

      const input = {
        settleAt: settleAt.toISOString(),
        direction: 'DOWN',
        status: 'PENDING',
      }

      const createResult = await makeAppSyncRequest<{
        createGuess: {
          id: string
          owner: string
          createdAt: string
          settleAt: string
          direction: string
          startPriceSnapshotId: string | null
          endPriceSnapshotId: string | null
          startPrice: number | null
          endPrice: number | null
          status: string
          result: string | null
          outcome: string | null
        }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: createMutation,
        variables: {
          input,
        },
      })

      expect(typeof createResult.createGuess.id).toBe('string')
      expect(createResult.createGuess.id).not.toBe('')
      expect(createResult.createGuess.owner).toBe(globalUser.sub)
      expect(typeof createResult.createGuess.createdAt).toBe('string')
      expect(
        new Date(createResult.createGuess.createdAt).getTime()
      ).toBeGreaterThan(0)

      // Check required fields match input
      expect(createResult.createGuess.direction).toBe(input.direction)
      expect(createResult.createGuess.status).toBe(input.status)
      expect(createResult.createGuess.settleAt).toBe(input.settleAt)

      // Settlement fields should be null on creation
      expect(createResult.createGuess.startPriceSnapshotId).toBeNull()
      expect(createResult.createGuess.endPriceSnapshotId).toBeNull()
      expect(createResult.createGuess.startPrice).toBeNull()
      expect(createResult.createGuess.endPrice).toBeNull()
      expect(createResult.createGuess.result).toBeNull()
      expect(createResult.createGuess.outcome).toBeNull()

      created.push(createResult.createGuess.id)
    })
  })

  describe('readGuess', () => {
    it('should read a Guess and return all selected fields', async () => {
      const getQuery = `
        query GetGuess($id: ID!) {
          getGuess(id: $id) {
            id
            owner
            direction
            status
          }
        }
      `

      const getResult = await makeAppSyncRequest<{
        getGuess: {
          id: string
          owner: string
          direction: string
          status: string
        }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: getQuery,
        variables: { id: seededGuessId },
      })

      expect(getResult.getGuess.id).toBe(seededGuessId)
      expect(getResult.getGuess.owner).toBe(globalUser.sub)
      expect(getResult.getGuess.direction).toBe('UP')
      expect(getResult.getGuess.status).toBe('PENDING')
    })
  })

  describe('updateGuess', () => {
    it('should update a Guess with settlement data and return all selected fields', async () => {
      const updateMutation = `
        mutation UpdateGuess($input: UpdateGuessInput!) {
          updateGuess(input: $input) {
            id
            startPriceSnapshotId
            endPriceSnapshotId
            startPrice
            endPrice
            status
            result
            outcome
          }
        }
      `

      const input = {
        id: seededGuessId,
        startPriceSnapshotId: 'snapshot-start-123',
        endPriceSnapshotId: 'snapshot-end-456',
        startPrice: 98500.0,
        endPrice: 99100.0,
        status: 'SETTLED',
        result: 'UP',
        outcome: 'WIN',
      }

      const updateResult = await makeAppSyncRequest<{
        updateGuess: {
          id: string
          startPriceSnapshotId: string
          endPriceSnapshotId: string
          startPrice: number
          endPrice: number
          status: string
          result: string
          outcome: string
        }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: updateMutation,
        variables: { input },
      })

      expect(updateResult.updateGuess).toMatchObject(input)
    })

    it('should update a Guess with a LOSS outcome', async () => {
      const updateMutation = `
        mutation UpdateGuess($input: UpdateGuessInput!) {
          updateGuess(input: $input) {
            id
            status
            result
            outcome
          }
        }
      `

      const input = {
        id: seededGuessId,
        startPrice: 98500.0,
        endPrice: 98000.0,
        status: 'SETTLED',
        result: 'DOWN', // Price went down
        outcome: 'LOSS', // User predicted UP, so they lost
      }

      const updateResult = await makeAppSyncRequest<{
        updateGuess: {
          id: string
          status: string
          result: string
          outcome: string
        }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: updateMutation,
        variables: { input },
      })

      expect(updateResult.updateGuess.status).toBe('SETTLED')
      expect(updateResult.updateGuess.result).toBe('DOWN')
      expect(updateResult.updateGuess.outcome).toBe('LOSS')
    })
  })

  describe('guessesByOwner', () => {
    it('should query guesses by owner with pagination', async () => {
      // Create a second guess to test pagination
      const now = new Date()
      const settleAt = new Date(now.getTime() + 60000)

      const createMutation = `
        mutation CreateGuess($input: CreateGuessInput!) {
          createGuess(input: $input) {
            id
          }
        }
      `

      const createResult = await makeAppSyncRequest<{
        createGuess: { id: string }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: createMutation,
        variables: {
          input: {
            settleAt: settleAt.toISOString(),
            direction: 'DOWN',
            status: 'PENDING',
          },
        },
      })

      created.push(createResult.createGuess.id)

      // Query guesses by owner
      const guessesByOwnerQuery = `
        query GuessesByOwner($owner: String!, $sortDirection: ModelSortDirection, $limit: Int) {
          guessesByOwner(owner: $owner, sortDirection: $sortDirection, limit: $limit) {
            items {
              id
              owner
              direction
              status
              createdAt
            }
            nextToken
          }
        }
      `

      const queryResult = await makeAppSyncRequest<{
        guessesByOwner: {
          items: Array<{
            id: string
            owner: string
            direction: string
            status: string
            createdAt: string
          }>
          nextToken: string | null
        }
      }>({
        endpoint: config.appsyncEndpoint,
        idToken,
        query: guessesByOwnerQuery,
        variables: {
          owner: globalUser.sub,
          sortDirection: 'DESC',
          limit: 10,
        },
      })

      expect(queryResult.guessesByOwner.items.length).toBeGreaterThanOrEqual(2)
      expect(
        queryResult.guessesByOwner.items.every(
          (item) => item.owner === globalUser.sub
        )
      ).toBe(true)

      // Verify descending order by createdAt
      const createdAts = queryResult.guessesByOwner.items.map((item) =>
        new Date(item.createdAt).getTime()
      )
      for (let i = 1; i < createdAts.length; i++) {
        expect(createdAts[i - 1]).toBeGreaterThanOrEqual(createdAts[i])
      }
    })
  })
})
