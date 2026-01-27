const https = require('https')

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
