import { readFileSync } from 'fs';
import { join } from 'path';

export interface GlobalTestUser {
  email: string;
  username: string;
  password: string;
  sub: string;
}

export function getGlobalTestUser(): GlobalTestUser {
  const filePath = join(__dirname, 'global-test-user.json');
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as GlobalTestUser;

    if (!parsed?.username || !parsed?.password || !parsed?.sub || !parsed?.email) {
      throw new Error('global-test-user.json missing required fields');
    }

    return parsed;
  } catch {
    throw new Error(
      'Global integration test user not found. Run with AMPLIFY_INTEGRATION_TESTS=true'
    );
  }
}

