/**
 * Unit tests for Cognito signup route
 *
 * Mocks AWS SDK v3 CognitoIdentityProviderClient
 */

import { POST } from './route'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

import { TEST_COGNITO_CLIENT_ID } from 'test/env'

describe('POST /api/cognito/signup', () => {
  let sendSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    sendSpy = jest
      .spyOn(CognitoIdentityProviderClient.prototype, 'send')
      .mockReset()
  })

  afterEach(() => {
    sendSpy.mockRestore()
  })

  it('should return 400 when email is missing', async () => {
    const req = new Request('http://localhost:3000/api/cognito/signup', {
      method: 'POST',
      body: JSON.stringify({ password: 'Test123!' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and password are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should return 400 when password is missing', async () => {
    const req = new Request('http://localhost:3000/api/cognito/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and password are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should return 400 when both email and password are missing', async () => {
    const req = new Request('http://localhost:3000/api/cognito/signup', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and password are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should normalize email (lowercase + trim) and call SignUpCommand', async () => {
    sendSpy.mockResolvedValueOnce({
      UserSub: 'test-user-sub',
    })

    const email = '  Test@Example.COM  '
    const password = 'SecurePass123!'

    const req = new Request('http://localhost:3000/api/cognito/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const command = sendSpy.mock.calls[0][0]
    expect(command).toBeInstanceOf(SignUpCommand)
    expect(command.input).toMatchObject({
      ClientId: TEST_COGNITO_CLIENT_ID,
      Username: 'test@example.com', // normalized
      Password: password,
      UserAttributes: [{ Name: 'email', Value: 'test@example.com' }],
    })
  })

  it('should propagate Cognito SDK errors (no error handling in signup route)', async () => {
    sendSpy.mockRejectedValueOnce(
      Object.assign(new Error('UsernameExistsException'), {
        name: 'UsernameExistsException',
      })
    )

    const req = new Request('http://localhost:3000/api/cognito/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'Test123!',
      }),
    })

    // Route does not catch errors, so it should throw
    await expect(POST(req)).rejects.toThrow('UsernameExistsException')
  })
})
