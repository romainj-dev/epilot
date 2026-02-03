jest.mock('@aws-sdk/client-scheduler', () => {
  const send = jest.fn()
  return {
    SchedulerClient: jest.fn(() => ({ send })),
    CreateScheduleCommand: jest.fn((input) => ({ input })),
    __mockSend: send,
  }
})

jest.mock('lambda-utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

const { __mockSend } = require('@aws-sdk/client-scheduler')
const { handler } = require('../index')

describe('scheduleGuessLambda handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SETTLE_GUESS_LAMBDA_ARN =
      'arn:aws:lambda:eu-north-1:123456789012:function:settleGuessLambda-dev'
    process.env.SCHEDULER_ROLE_ARN =
      'arn:aws:iam::123456789012:role/scheduler-role'
  })

  afterEach(() => {
    delete process.env.SETTLE_GUESS_LAMBDA_ARN
    delete process.env.SCHEDULER_ROLE_ARN
  })

  it('creates a schedule for INSERT PENDING records', async () => {
    __mockSend.mockResolvedValueOnce({})

    const settleAt = new Date(Date.now() + 60000).toISOString()
    await handler({
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              id: { S: 'g-123' },
              settleAt: { S: settleAt },
              status: { S: 'PENDING' },
            },
          },
        },
      ],
    })

    expect(__mockSend).toHaveBeenCalledTimes(1)
    expect(__mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          GroupName: 'guess-settlements',
          ScheduleExpression: expect.stringMatching(/^at\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\)$/),
          ActionAfterCompletion: 'DELETE',
          Target: expect.objectContaining({
            Input: JSON.stringify({ guessId: 'g-123' }),
          }),
        })
      })
    )
  })

  it('skips non-INSERT and non-PENDING records', async () => {
    await handler({
      Records: [
        { eventName: 'MODIFY', dynamodb: { NewImage: {} } },
        {
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              id: { S: 'g-999' },
              settleAt: { S: new Date().toISOString() },
              status: { S: 'SETTLED' },
            },
          },
        },
      ],
    })
    expect(__mockSend).not.toHaveBeenCalled()
  })
})

