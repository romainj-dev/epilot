// Mock lambda-utils before requiring the handler
jest.mock('lambda-utils', () => ({
  ssm: {
    getCachedParameterOrNull: jest.fn(),
  },
  appsync: {
    makeAppSyncRequest: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { handler } = require('../custom');
const { ssm, appsync, logger } = require('lambda-utils');

describe('epilotAuthPostConfirmation Lambda handler', () => {
  const MOCK_ENDPOINT = 'https://mock-appsync.amazonaws.com/graphql';
  const MOCK_API_KEY = 'da2-mockApiKey123';
  const MOCK_SUB = '123e4567-e89b-12d3-a456-426614174000';
  const MOCK_EMAIL = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPSYNC_ENDPOINT_SSM_PATH = '/test/appsync/endpoint';
    process.env.APPSYNC_API_KEY_SSM_PATH = '/test/appsync/apikey';
  });

  afterEach(() => {
    delete process.env.APPSYNC_ENDPOINT_SSM_PATH;
    delete process.env.APPSYNC_API_KEY_SSM_PATH;
  });

  function createMockEvent(triggerSource, email, sub) {
    return {
      triggerSource,
      request: {
        userAttributes: {
          email,
          sub,
        },
      },
    };
  }

  describe('Non-confirm trigger', () => {
    it('should skip processing for PreSignUp_SignUp trigger', async () => {
      const event = createMockEvent('PreSignUp_SignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.info).toHaveBeenCalledWith('Skipping - not a ConfirmSignUp trigger');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should skip processing for PostAuthentication_Authentication trigger', async () => {
      const event = createMockEvent(
        'PostAuthentication_Authentication',
        MOCK_EMAIL,
        MOCK_SUB
      );

      const result = await handler(event);

      expect(result).toBe(event);
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });
  });

  describe('Missing email/sub', () => {
    beforeEach(() => {
      ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });
    });

    it('should not call AppSync when email is missing', async () => {
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', null, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith('Missing required user attributes');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should not call AppSync when sub is missing', async () => {
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, null);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith('Missing required user attributes');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should not call AppSync when both email and sub are missing', async () => {
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', null, null);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith('Missing required user attributes');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });
  });

  describe('Missing SSM env vars', () => {
    beforeEach(() => {
      ssm.getCachedParameterOrNull.mockResolvedValue(null);
    });

    it('should not call AppSync when APPSYNC_ENDPOINT_SSM_PATH is missing', async () => {
      delete process.env.APPSYNC_ENDPOINT_SSM_PATH;
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith(
        'Missing APPSYNC_ENDPOINT_SSM_PATH or APPSYNC_API_KEY_SSM_PATH env var'
      );
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should not call AppSync when APPSYNC_API_KEY_SSM_PATH is missing', async () => {
      delete process.env.APPSYNC_API_KEY_SSM_PATH;
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith(
        'Missing APPSYNC_ENDPOINT_SSM_PATH or APPSYNC_API_KEY_SSM_PATH env var'
      );
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should not call AppSync when endpoint cannot be retrieved from SSM', async () => {
      ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return null;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });

      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith('Failed to retrieve AppSync endpoint from SSM');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should not call AppSync when API key cannot be retrieved from SSM', async () => {
      ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return null;
        return null;
      });

      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith('Failed to retrieve API key from SSM');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });
  });

  describe('Happy path', () => {
    beforeEach(() => {
      ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });
      appsync.makeAppSyncRequest.mockResolvedValue({ id: MOCK_SUB });
    });

    it('should call AppSync createUserState with expected input', async () => {
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: MOCK_ENDPOINT,
          apiKey: MOCK_API_KEY,
          query: expect.stringContaining('createUserState'),
          variables: {
            input: {
              id: MOCK_SUB,
              owner: MOCK_SUB,
              email: MOCK_EMAIL,
              username: 'test', // from email split
              score: 0,
              streak: 0,
              lastUpdatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            },
          },
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully created UserState',
        expect.objectContaining({ sub: MOCK_SUB })
      );
    });

    it('should extract username from email correctly', async () => {
      const event = createMockEvent(
        'PostConfirmation_ConfirmSignUp',
        'john.doe@company.com',
        MOCK_SUB
      );

      await handler(event);

      expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              username: 'john.doe',
            }),
          }),
        })
      );
    });

    it('should use email as username when no @ sign', async () => {
      const event = createMockEvent('PostConfirmation_ConfirmSignUp', 'testuser', MOCK_SUB);

      await handler(event);

      expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              username: 'testuser',
            }),
          }),
        })
      );
    });
  });

  describe('AppSync error', () => {
    beforeEach(() => {
      ssm.getCachedParameterOrNull.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });
    });

    it('should log error and still return event when AppSync fails', async () => {
      const mockError = new Error('AppSync mutation failed');
      mockError.name = 'AppSyncError';
      appsync.makeAppSyncRequest.mockRejectedValue(mockError);

      const event = createMockEvent('PostConfirmation_ConfirmSignUp', MOCK_EMAIL, MOCK_SUB);

      const result = await handler(event);

      expect(result).toBe(event);
      expect(logger.error).toHaveBeenCalledWith(
        'PostConfirmation createUserState failed',
        expect.objectContaining({
          errorName: 'AppSyncError',
          errorMessage: 'AppSync mutation failed',
        })
      );
    });
  });
});
