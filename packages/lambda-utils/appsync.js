/**
 * AppSync HTTP client for Lambda functions
 *
 * Minimal GraphQL client using Node.js https module (no dependencies).
 * Supports both API key and Cognito authentication for server-side Lambda operations.
 */

const https = require('https')

/**
 * Execute a GraphQL request against AppSync
 *
 * @param {Object} params - Request parameters
 * @param {string} params.endpoint - AppSync HTTP endpoint URL
 * @param {string} [params.apiKey] - AppSync API key (for public operations)
 * @param {string} [params.idToken] - Cognito ID token (for user-specific operations)
 * @param {string} params.query - GraphQL query or mutation string
 * @param {Object} [params.variables] - GraphQL variables
 * @param {Function} [params.onResponse] - Callback with raw response ({ statusCode, body })
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} On network errors or GraphQL errors
 */
function makeAppSyncRequest({
  endpoint,
  apiKey,
  idToken,
  query,
  variables,
  onResponse,
}) {
  const url = new URL(endpoint)
  const body = JSON.stringify({ query, variables })

  return new Promise((resolve, reject) => {
    if (!apiKey && !idToken) {
      reject(new Error('Either apiKey or idToken must be provided'))
      return
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : { Authorization: idToken }),
    }

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (typeof onResponse === 'function') {
            onResponse({ statusCode: res.statusCode, body: data })
          }

          try {
            const result = JSON.parse(data)
            if (result.errors && result.errors.length > 0) {
              reject(
                new Error(`AppSync error: ${JSON.stringify(result.errors)}`)
              )
              return
            }
            resolve(result)
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = {
  makeAppSyncRequest,
}
