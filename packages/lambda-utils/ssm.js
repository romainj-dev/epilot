/**
 * AWS Systems Manager Parameter Store client for Lambda
 *
 * Fetches configuration values from SSM with in-memory caching.
 * Caching prevents repeated SSM API calls within a single Lambda invocation
 * (Lambda containers are reused across invocations, so cache persists).
 */

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm')
const logger = require('./logger')

const cachedParameters = new Map()

/**
 * Fetch a parameter from SSM Parameter Store
 *
 * @param {string} name - Parameter name/path
 * @param {Object} [options] - Fetch options
 * @param {boolean} [options.withDecryption=true] - Decrypt SecureString parameters
 * @returns {Promise<string|null>} Parameter value or null if not found
 */
async function getParameterValue(name, options = {}) {
  if (!name) {
    throw new Error('SSM parameter name is required')
  }

  const client = new SSMClient({ region: process.env.AWS_REGION })
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: options.withDecryption !== false,
  })
  const response = await client.send(command)
  return response.Parameter?.Value ?? null
}

/**
 * Fetch a parameter with in-memory caching
 *
 * Cache persists for the lifetime of the Lambda container (across invocations).
 * Use for static config; avoid for frequently changing values.
 */
async function getCachedParameter(name, options = {}) {
  if (cachedParameters.has(name)) {
    return cachedParameters.get(name)
  }

  const value = await getParameterValue(name, options)
  cachedParameters.set(name, value)
  return value
}

/**
 * Fetch a parameter with caching, returning null on errors instead of throwing
 *
 * Useful for optional configuration where absence is acceptable.
 */
async function getCachedParameterOrNull(name, options = {}) {
  try {
    return await getCachedParameter(name, options)
  } catch (error) {
    logger.error('SSM parameter fetch failed', {
      parameterName: name,
      errorName: error?.name,
      errorMessage: error?.message,
    })
    return null
  }
}

module.exports = {
  getParameterValue,
  getCachedParameter,
  getCachedParameterOrNull,
}
