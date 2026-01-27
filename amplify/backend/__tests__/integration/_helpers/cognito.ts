/**
 * Cognito helper for integration tests
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  InitiateAuthCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface TestUser {
  username: string;
  email: string;
  password: string;
  sub?: string;
}

export class CognitoTestHelper {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;

  constructor(region: string, userPoolId: string, clientId: string) {
    this.client = new CognitoIdentityProviderClient({ region });
    this.userPoolId = userPoolId;
    this.clientId = clientId;
  }

  async createTestUser(email: string, password: string): Promise<TestUser> {
    // Cognito expects Username to be an email.
    const username = email;

    try {
      // Create user
      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: 'SUPPRESS', // Don't send welcome email
        })
      );

      // Set permanent password
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          Password: password,
          Permanent: true,
        })
      );

      // Get the user's sub
      const getUserResponse = await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        })
      );

      const sub = getUserResponse.UserAttributes?.find(
        (attr) => attr.Name === 'sub'
      )?.Value;

      return {
        username,
        email,
        password,
        sub,
      };
    } catch (error) {
      // Clean up if user was created but password set failed
      await this.deleteUser(username);
      throw error;
    }
  }

  async deleteUser(username: string): Promise<void> {
    try {
      await this.client.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
            Username: username,
          })
        );
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Failed to delete User ${this.userPoolId}:`, error);
    }
  }

  async getIdToken(username: string, password: string): Promise<string> {
    // Cognito can be eventually consistent right after AdminCreateUser/AdminSetUserPassword.
    // Retry a few times to avoid flakes.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await this.client.send(
          new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: this.clientId,
            AuthParameters: {
              USERNAME: username,
              PASSWORD: password,
            },
          })
        );

        if (!response.AuthenticationResult?.IdToken) {
          throw new Error('Failed to obtain ID token from Cognito');
        }

        return response.AuthenticationResult.IdToken;
      } catch (err) {
        lastError = err;
        // Small backoff
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to obtain ID token from Cognito');
  }
}
