const https = require('https');

// Mock lambda-utils before requiring the handler
jest.mock('lambda-utils', () => ({
  ssm: {
    getParameterValue: jest.fn(),
    getCachedParameter: jest.fn(),
  },
  appsync: {
    makeAppSyncRequest: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock https.request
jest.mock('https');

const { handler } = require('../index');
const { ssm, appsync, logger } = require('lambda-utils');

describe('priceSnapshotJob Lambda handler', () => {
  const MOCK_ENDPOINT = 'https://mock-appsync.amazonaws.com/graphql';
  const MOCK_API_KEY = 'da2-mockApiKey123';
  const MOCK_BITCOIN_PRICE = 98765.4321;
  const MOCK_LAST_UPDATED_AT = 1706000000;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set required env vars
    process.env.APPSYNC_ENDPOINT_SSM_PATH = '/test/appsync/endpoint';
    process.env.APPSYNC_API_KEY_SSM_PATH = '/test/appsync/apikey';
    process.env.PRICE_SNAPSHOT_ENABLED_SSM_PATH = '/test/price-snapshot-enabled';
    process.env.PRICE_SNAPSHOT_INTERVAL_SSM_PATH = '/test/price-snapshot-interval';
  });

  afterEach(() => {
    delete process.env.APPSYNC_ENDPOINT_SSM_PATH;
    delete process.env.APPSYNC_API_KEY_SSM_PATH;
    delete process.env.PRICE_SNAPSHOT_ENABLED_SSM_PATH;
    delete process.env.PRICE_SNAPSHOT_INTERVAL_SSM_PATH;
    delete process.env.COINGECKO_API_KEY_SSM_PATH;
  });

  describe('Missing required env vars', () => {
    it('should return disabled when APPSYNC_ENDPOINT_SSM_PATH is missing', async () => {
      delete process.env.APPSYNC_ENDPOINT_SSM_PATH;

      const result = await handler();

      expect(result).toEqual({ enabled: false, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith(
        'Missing required env vars',
        expect.objectContaining({ endpointPath: undefined })
      );
    });

    it('should return disabled when APPSYNC_API_KEY_SSM_PATH is missing', async () => {
      delete process.env.APPSYNC_API_KEY_SSM_PATH;

      const result = await handler();

      expect(result).toEqual({ enabled: false, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith(
        'Missing required env vars',
        expect.objectContaining({ apiKeyPath: undefined })
      );
    });
  });

  describe('SSM enabled=false', () => {
    it('should return disabled and not call CoinGecko/AppSync when enabled=false', async () => {
      ssm.getParameterValue.mockImplementation(async (path) => {
        if (path.includes('enabled')) return 'false';
        if (path.includes('interval')) return '60';
        return null;
      });
      ssm.getCachedParameter.mockResolvedValue(MOCK_ENDPOINT);

      const result = await handler();

      expect(result).toEqual({ enabled: false, intervalSeconds: 60 });
      expect(logger.info).toHaveBeenCalledWith('Price snapshot job disabled');
      expect(https.request).not.toHaveBeenCalled();
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should parse various disabled values correctly', async () => {
      for (const disabledValue of ['false', 'False', 'FALSE', '0', 'off', 'OFF']) {
        jest.clearAllMocks();
        ssm.getParameterValue.mockImplementation(async (path) => {
          if (path.includes('enabled')) return disabledValue;
          if (path.includes('interval')) return '45';
          return null;
        });
        ssm.getCachedParameter.mockResolvedValue(MOCK_ENDPOINT);

        const result = await handler();

        expect(result).toEqual({ enabled: false, intervalSeconds: 45 });
      }
    });
  });

  describe('Happy path (enabled=true)', () => {
    beforeEach(() => {
      // Mock SSM responses
      ssm.getParameterValue.mockImplementation(async (path) => {
        if (path.includes('enabled')) return 'true';
        if (path.includes('interval')) return '120';
        return null;
      });
      ssm.getCachedParameter.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });

      // Mock successful CoinGecko response
      const mockRes = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(
              JSON.stringify({
                bitcoin: {
                  usd: MOCK_BITCOIN_PRICE,
                  last_updated_at: MOCK_LAST_UPDATED_AT,
                },
              })
            );
          } else if (event === 'end') {
            handler();
          }
        }),
      };

      const mockReq = {
        on: jest.fn(),
        end: jest.fn(),
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      appsync.makeAppSyncRequest.mockResolvedValue({});
    });

    it('should fetch Bitcoin price and create AppSync snapshot', async () => {
      const result = await handler();

      expect(result).toEqual({ enabled: true, intervalSeconds: 120 });

      // Verify CoinGecko was called
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.coingecko.com',
          method: 'GET',
        }),
        expect.any(Function)
      );

      // Verify AppSync mutation was called
      expect(appsync.makeAppSyncRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: MOCK_ENDPOINT,
          apiKey: MOCK_API_KEY,
          query: expect.stringContaining('createPriceSnapshot'),
          variables: expect.objectContaining({
            input: expect.objectContaining({
              pk: 'PriceSnapshot',
              priceUsd: MOCK_BITCOIN_PRICE,
              source: 'coingecko',
              sourceUpdatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
              capturedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            }),
          }),
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Price snapshot created',
        expect.objectContaining({
          priceUsd: MOCK_BITCOIN_PRICE,
        })
      );
    });
  });

  describe('CoinGecko failure / unexpected response', () => {
    beforeEach(() => {
      ssm.getParameterValue.mockImplementation(async (path) => {
        if (path.includes('enabled')) return 'true';
        if (path.includes('interval')) return '30';
        return null;
      });
      ssm.getCachedParameter.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return MOCK_API_KEY;
        return null;
      });
    });

    it('should log error and still return enabled:true when CoinGecko returns invalid JSON', async () => {
      const mockRes = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('invalid-json');
          } else if (event === 'end') {
            handler();
          }
        }),
      };

      const mockReq = {
        on: jest.fn(),
        end: jest.fn(),
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await handler();

      expect(result).toEqual({ enabled: true, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith(
        'Price snapshot job failed',
        expect.objectContaining({
          errorName: expect.any(String),
          errorMessage: expect.any(String),
        })
      );
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });

    it('should log error when CoinGecko response is missing price', async () => {
      const mockRes = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ bitcoin: {} }));
          } else if (event === 'end') {
            handler();
          }
        }),
      };

      const mockReq = {
        on: jest.fn(),
        end: jest.fn(),
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await handler();

      expect(result).toEqual({ enabled: true, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith(
        'Price snapshot job failed',
        expect.objectContaining({
          errorMessage: expect.stringContaining('Unexpected CoinGecko response'),
        })
      );
    });

    it('should log error when https.request fails', async () => {
      const mockReq = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
        }),
        end: jest.fn(),
      };

      https.request.mockImplementation(() => {
        process.nextTick(() => {
          mockReq.on.mock.calls
            .filter(([event]) => event === 'error')
            .forEach(([, handler]) => handler(new Error('Network error')));
        });
        return mockReq;
      });

      const result = await handler();

      expect(result).toEqual({ enabled: true, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith(
        'Price snapshot job failed',
        expect.objectContaining({
          errorMessage: 'Network error',
        })
      );
    });
  });

  describe('Missing AppSync API key from SSM', () => {
    beforeEach(() => {
      ssm.getParameterValue.mockImplementation(async (path) => {
        if (path.includes('enabled')) return 'true';
        if (path.includes('interval')) return '60';
        return null;
      });
      ssm.getCachedParameter.mockImplementation(async (path) => {
        if (path.includes('endpoint')) return MOCK_ENDPOINT;
        if (path.includes('apikey')) return null; // Missing API key
        return null;
      });

      // Mock successful CoinGecko response
      const mockRes = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(
              JSON.stringify({
                bitcoin: {
                  usd: MOCK_BITCOIN_PRICE,
                  last_updated_at: MOCK_LAST_UPDATED_AT,
                },
              })
            );
          } else if (event === 'end') {
            handler();
          }
        }),
      };

      const mockReq = {
        on: jest.fn(),
        end: jest.fn(),
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });
    });

    it('should log error and return enabled:true without calling AppSync', async () => {
      const result = await handler();

      expect(result).toEqual({ enabled: true, intervalSeconds: 60 });
      expect(logger.error).toHaveBeenCalledWith('Missing AppSync API key');
      expect(appsync.makeAppSyncRequest).not.toHaveBeenCalled();
    });
  });

  describe('Missing AppSync endpoint from SSM', () => {
    it('should return disabled when endpoint cannot be retrieved', async () => {
      ssm.getParameterValue.mockImplementation(async (path) => {
        if (path.includes('enabled')) return 'true';
        if (path.includes('interval')) return '60';
        return null;
      });
      ssm.getCachedParameter.mockResolvedValue(null); // No endpoint

      const result = await handler();

      expect(result).toEqual({ enabled: false, intervalSeconds: 30 });
      expect(logger.error).toHaveBeenCalledWith('Failed to retrieve AppSync endpoint from SSM');
    });
  });
});
