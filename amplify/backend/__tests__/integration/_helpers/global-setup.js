const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

const { resolveTestConfigPartials } = require('./config.shared.js')
const { AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider')
// NOTE: globalSetup runs outside Jest's normal module resolution (moduleNameMapper),
// so we require the workspace file directly rather than `lambda-utils/appsync`.
const { makeAppSyncRequest } = require(path.join(
  process.cwd(),
  'packages',
  'lambda-utils',
  'appsync.js'
))

async function createUserState({ endpoint, apiKey, sub, email, username }) {
  const createMutation = `
    mutation CreateUserState($input: CreateUserStateInput!) {
      createUserState(input: $input) { id }
    }
  `

  const created = await makeAppSyncRequest({
    endpoint,
    apiKey,
    query: createMutation,
    variables: {
      input: {
        id: sub,
        owner: sub,
        email,
        username,
        score: 0,
        streak: 0,
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  })

  if (!created?.data?.createUserState?.id) {
    throw new Error('Failed to create UserState for global test user')
  }

  return created.data.createUserState
}

async function createGlobalTestUser({ region, cognitoUserPoolId, email, username, password }) {
  const client = new CognitoIdentityProviderClient({ region })

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: cognitoUserPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: 'SUPPRESS',
    })
  )

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: cognitoUserPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    })
  )

  const getUserResponse = await client.send(
    new AdminGetUserCommand({
      UserPoolId: cognitoUserPoolId,
      Username: username,
    })
  )

  const sub = getUserResponse.UserAttributes?.find(
    (attr) => attr.Name === 'sub'
  )?.Value

  if (!sub) {
    throw new Error('Failed to resolve Cognito user sub in globalSetup')
  }

  return { email, username, password, sub }
}

module.exports = async () => {
  if (process.env.AMPLIFY_INTEGRATION_TESTS !== 'true') {
    return
  }

  const { region, cognitoUserPoolId, cognitoClientId, appsyncEndpoint, appsyncApiKey } =
    resolveTestConfigPartials()

  if (!region || !cognitoUserPoolId || !cognitoClientId || !appsyncEndpoint || !appsyncApiKey) {
    throw new Error(
      'Missing Cognito integration test config. Provide env vars or ensure amplify/backend/amplify-meta.json exists.\n' +
        `  region: ${region ? '✓' : '✗'}\n` +
        `  appsyncEndpoint: ${appsyncEndpoint ? '✓' : '✗'}\n` +
        `  appsyncApiKey: ${appsyncApiKey ? '✓' : '✗'}\n` +
        `  cognitoUserPoolId: ${cognitoUserPoolId ? '✓' : '✗'}\n` +
        `  cognitoClientId: ${cognitoClientId ? '✓' : '✗'}\n`
    )
  }

  const outPath = path.join(__dirname, 'global-test-user.json')
  if (fs.existsSync(outPath)) {
    // Previous run may have crashed and left stale creds; best-effort cleanup then recreate.
    try {
      const raw = fs.readFileSync(outPath, 'utf8')
      const prev = JSON.parse(raw)
      if (prev?.username) {
        try {
          const client = new CognitoIdentityProviderClient({ region })
          await client.send(
            new AdminDeleteUserCommand({
              UserPoolId: cognitoUserPoolId,
              Username: prev.username,
            })
          )
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(outPath)
    } catch {
      // ignore
    }
  }

  const rand = crypto.randomBytes(3).toString('hex')
  const email = `jest-int-global-${Date.now()}-${rand}@example.com`
  const password = 'TempPass123!'
  const username = email // Cognito username is email for our pool


  const user = await createGlobalTestUser({ region, cognitoUserPoolId, email, username, password })

  // Integration tests expect a persistent UserState row keyed by `id = sub`
  const userState = await createUserState({
    endpoint: appsyncEndpoint,
    apiKey: appsyncApiKey,
    sub: user.sub,
    email: user.email,
    username: user.username,
  })

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        email: user.email,
        username: user.username,
        password: user.password,
        sub: user.sub,
        createdAt: new Date().toISOString(),
        userState,
      },
      null,
      2
    )
  )
}

