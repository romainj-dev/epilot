const fs = require('fs')
const path = require('path')

const {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider')

const { readJsonOrNull, resolveTestConfigPartials } = require('./config.shared.js')

module.exports = async () => {
  if (process.env.AMPLIFY_INTEGRATION_TESTS !== 'true') {
    return
  }

  const filePath = path.join(__dirname, 'global-test-user.json')
  const payload = readJsonOrNull(filePath)
  if (!payload?.username) {
    console.warn('Global test user not found, skipping cleanup')
    return
  }

  const { region, cognitoUserPoolId } = resolveTestConfigPartials()
  try {
    const client = new CognitoIdentityProviderClient({ region })
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: cognitoUserPoolId,
        Username: payload.username,
      })
    )
  } catch (error) {
    console.warn(`Failed to delete User ${payload.username}:`, error)
  }

  try {
    fs.unlinkSync(filePath)
  } catch (error) {
    console.warn(`Failed to delete global-test-user.json:`, error)
  }
}

