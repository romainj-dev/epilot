/**
 * Shared utilities for AWS Lambda functions
 *
 * Common libraries used across all Lambda functions in the amplify/backend/function/ directory.
 * Provides AppSync client, SSM config management, and structured logging.
 */

const appsync = require('./appsync')
const ssm = require('./ssm')
const logger = require('./logger')

module.exports = {
  appsync,
  ssm,
  logger,
}
