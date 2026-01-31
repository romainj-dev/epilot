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

export {}
