const https = require('https')
const { appsync, ssm, logger } = require('lambda-utils')

const { makeAppSyncRequest } = appsync

const DEFAULT_INTERVAL_SECONDS = 30
const COINGECKO_URL =
  process.env.COINGECKO_URL ||
  'https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=bitcoin&names=Bitcoin&symbols=btc&include_24hr_vol=false&include_24hr_change=false&include_last_updated_at=true&precision=full'

const COINGECKO_API_KEY_HEADER =
  process.env.COINGECKO_API_KEY_HEADER || 'x-cg-pro-api-key'

exports.handler = async () => {
  const endpointPath = process.env.APPSYNC_ENDPOINT_SSM_PATH
  const apiKeyPath = process.env.APPSYNC_API_KEY_SSM_PATH
  const enabledPath = process.env.PRICE_SNAPSHOT_ENABLED_SSM_PATH
  const intervalPath = process.env.PRICE_SNAPSHOT_INTERVAL_SSM_PATH
  const coinGeckoApiKeyPath = process.env.COINGECKO_API_KEY_SSM_PATH

  if (!endpointPath || !apiKeyPath || !enabledPath || !intervalPath) {
    logger.error('Missing required env vars', {
      endpointPath,
      apiKeyPath,
      enabledPath,
      intervalPath,
    })
    return { enabled: false, intervalSeconds: DEFAULT_INTERVAL_SECONDS }
  }

  const [enabledValue, intervalValue, endpoint] = await Promise.all([
    ssm.getParameterValue(enabledPath),
    ssm.getParameterValue(intervalPath),
    ssm.getCachedParameter(endpointPath),
  ])

  if (!endpoint) {
    logger.error('Failed to retrieve AppSync endpoint from SSM')
    return { enabled: false, intervalSeconds: DEFAULT_INTERVAL_SECONDS }
  }

  const isEnabled = parseEnabled(enabledValue)
  const intervalSeconds = parseInterval(intervalValue)

  if (!isEnabled) {
    logger.info('Price snapshot job disabled')
    return { enabled: false, intervalSeconds }
  }

  try {
    const coinGeckoApiKey = coinGeckoApiKeyPath
      ? await ssm.getParameterValue(coinGeckoApiKeyPath)
      : null
    const { priceUsd, sourceUpdatedAt } = await fetchBitcoinPriceUsd(
      coinGeckoApiKey
    )
    const apiKey = await ssm.getCachedParameter(apiKeyPath)

    if (!apiKey) {
      logger.error('Missing AppSync API key')
      return { enabled: true, intervalSeconds }
    }

    const capturedAt = new Date().toISOString()

    const mutation = `
      mutation CreatePriceSnapshot($input: CreatePriceSnapshotInput!) {
        createPriceSnapshot(input: $input) {
          id
        }
      }
    `

    await makeAppSyncRequest({
      endpoint,
      apiKey,
      query: mutation,
      variables: {
        input: {
          pk: 'PriceSnapshot',
          capturedAt,
          priceUsd,
          sourceUpdatedAt,
          source: 'coingecko',
        },
      },
    })

    logger.info('Price snapshot created', { capturedAt, priceUsd })
  } catch (error) {
    logger.error('Price snapshot job failed', {
      errorName: error?.name,
      errorMessage: error?.message,
    })
  }

  return { enabled: true, intervalSeconds }
}

function parseEnabled(value) {
  if (value == null) {
    return true
  }

  const normalized = String(value).trim().toLowerCase()
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off'
}

function parseInterval(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_INTERVAL_SECONDS
  }
  return parsed
}

async function fetchBitcoinPriceUsd(apiKey) {
  const response = await httpsGetJson(COINGECKO_URL, apiKey)
  const priceUsd = response?.bitcoin?.usd
  const lastUpdatedAt = response?.bitcoin?.last_updated_at

  if (typeof priceUsd !== 'number') {
    throw new Error(`Unexpected CoinGecko response: ${JSON.stringify(response)}`)
  }

  if (!lastUpdatedAt) {
    throw new Error(`Missing last_updated_at in CoinGecko response: ${JSON.stringify(response)}`)
  }
  return {
    priceUsd,
    sourceUpdatedAt: toIsoTimestamp(lastUpdatedAt),
  }
}

function toIsoTimestamp(epochSeconds) {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) {
    return null
  }
  return new Date(epochSeconds * 1000).toISOString()
}

function httpsGetJson(urlString, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const headers = {
      accept: 'application/json',
      'user-agent': 'epilot-bitbet-price-snapshot/1.0 (+https://epilot-bitbet.app)',
    }
    if (apiKey) {
      headers[COINGECKO_API_KEY_HEADER] = apiKey
    }
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed)
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    req.on('error', reject)
    req.end()
  })
}

