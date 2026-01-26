const https = require('https')

function makeAppSyncRequest({
  endpoint,
  apiKey,
  query,
  variables,
  onResponse,
}) {
  const url = new URL(endpoint)
  const body = JSON.stringify({ query, variables })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
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
