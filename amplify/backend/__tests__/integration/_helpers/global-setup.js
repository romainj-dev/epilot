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

module.exports = async () => {
  if (process.env.AMPLIFY_INTEGRATION_TESTS !== 'true') {
    return
  }

  const { region, cognitoUserPoolId, cognitoClientId } =
    resolveTestConfigPartials()

  if (!region || !cognitoUserPoolId || !cognitoClientId) {
    throw new Error(
      'Missing Cognito integration test config. Provide env vars or ensure amplify/backend/amplify-meta.json exists.\n' +
        `  region: ${region ? '✓' : '✗'}\n` +
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

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        email,
        username,
        password,
        sub,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  )
}

