/**
 * Unit tests for Cognito confirm signup route
 *
 * Mocks AWS SDK v3 CognitoIdentityProviderClient
 */

import { POST } from './route'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

import { TEST_COGNITO_CLIENT_ID } from 'test/env'

describe('POST /api/cognito/confirm', () => {
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
    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and code are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should return 400 when code is missing', async () => {
    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and code are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should return 400 when both email and code are missing', async () => {
    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json).toEqual({ error: 'email and code are required' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('should normalize email and trim code, then call ConfirmSignUpCommand', async () => {
    sendSpy.mockResolvedValueOnce({})

    const email = '  Test@Example.COM  '
    const code = '  123456  '

    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const command = sendSpy.mock.calls[0][0]
    expect(command).toBeInstanceOf(ConfirmSignUpCommand)
    expect(command.input).toMatchObject({
      ClientId: TEST_COGNITO_CLIENT_ID,
      Username: 'test@example.com', // normalized
      ConfirmationCode: '123456', // trimmed
    })
  })

  it('should return 500 with error name when Cognito throws CodeMismatchException', async () => {
    sendSpy.mockRejectedValueOnce(
      Object.assign(new Error('Invalid verification code provided'), {
        name: 'CodeMismatchException',
      })
    )

    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        code: 'wrong-code',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ error: 'CodeMismatchException' })
  })

  it('should return 500 with error name when Cognito throws ExpiredCodeException', async () => {
    sendSpy.mockRejectedValueOnce(
      Object.assign(new Error('Code expired'), {
        name: 'ExpiredCodeException',
      })
    )

    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        code: '123456',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ error: 'ExpiredCodeException' })
  })

  it('should return 500 with generic error when error has no name', async () => {
    sendSpy.mockRejectedValueOnce(new Error('Unknown error'))

    const req = new Request('http://localhost:3000/api/cognito/confirm', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        code: '123456',
      }),
    })

    const response = await POST(req)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json).toEqual({ error: 'ConfirmSignUpFailed' })
  })
})
