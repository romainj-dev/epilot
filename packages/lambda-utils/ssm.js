const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm')
const logger = require('./logger')

const cachedParameters = new Map()

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

async function getCachedParameter(name, options = {}) {
  if (cachedParameters.has(name)) {
    return cachedParameters.get(name)
  }

  const value = await getParameterValue(name, options)
  cachedParameters.set(name, value)
  return value
}

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
