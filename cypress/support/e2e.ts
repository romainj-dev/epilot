// ***********************************************************
// This file is processed and loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
//
// @see cypress/README.md for setup instructions
// ***********************************************************

// Import custom commands
import './commands'

// Prevent TypeScript errors on cy.task
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      task(
        event: string,
        arg?: unknown,
        options?: Partial<Loggable & Timeoutable>
      ): Chainable<unknown>
    }
  }
}

Cypress.on('uncaught:exception', (err) => {
  // Silencing known known issue from react https://github.com/vercel/next.js/issues/86060
  if (
    err.message.includes('DashboardLayout') &&
    err.message.includes('negative time stamp')
  ) {
    return false
  }
})

export {}
