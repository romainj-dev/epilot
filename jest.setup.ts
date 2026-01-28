/**
 * Global Jest setup for unit tests.
 *
 * We seed a minimal set of env vars used by BFF routes so individual test files
 * don't need to repeat this boilerplate.
 */

import {
  TEST_AUTH_SECRET,
  TEST_AWS_REGION,
  TEST_COGNITO_CLIENT_ID,
} from './test/env'

process.env.AWS_REGION ??= TEST_AWS_REGION
process.env.COGNITO_CLIENT_ID ??= TEST_COGNITO_CLIENT_ID
process.env.AUTH_SECRET ??= TEST_AUTH_SECRET

/**
 * Global console silencing for unit tests.
 *
 * Many server-side modules intentionally log on error paths (and some modules
 * are chatty by design). To keep CI output readable, we silence console by
 * default. If you need logs while debugging, run:
 *   JEST_SHOW_CONSOLE=1 pnpm test:bff
 */
if (process.env.JEST_SHOW_CONSOLE !== 'true') {
  const noop = () => {}

  /**
   * NOTE: Jest config enables `restoreMocks: true`, which restores all spies
   * between tests. So we (re)apply the console spies in a global `beforeEach`
   * to keep logs consistently silenced across the whole suite.
   */
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(noop)
    jest.spyOn(console, 'info').mockImplementation(noop)
    jest.spyOn(console, 'warn').mockImplementation(noop)
    jest.spyOn(console, 'error').mockImplementation(noop)
    jest.spyOn(console, 'debug').mockImplementation(noop)
  })
}
