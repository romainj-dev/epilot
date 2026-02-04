/// <reference types="cypress" />

// Import cypress-axe for accessibility testing
import 'cypress-axe'

/**
 * Custom Cypress Commands for E2E Testing
 * @see cypress/README.md for usage examples
 */

/**
 * Select element by data-testid attribute
 * @example cy.getByTestId('signin-email')
 */
Cypress.Commands.add('getByTestId', (testId: string, options) => {
  return cy.get(`[data-testid="${testId}"]`, options)
})

/**
 * Programmatic login via NextAuth API
 * Bypasses UI for faster test setup
 *
 * @param email - User email
 * @param password - User password
 *
 * @example cy.loginByApi('user@example.com', 'password123')
 */
Cypress.Commands.add('loginByApi', (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      // Visit the app first to establish the domain
      cy.visit('/')

      // Get CSRF token first (required by NextAuth)
      cy.request('/api/auth/csrf').then((csrfResponse) => {
        const csrfToken = csrfResponse.body.csrfToken

        // Call NextAuth credentials provider with CSRF token
        cy.request({
          method: 'POST',
          url: '/api/auth/callback/credentials',
          body: {
            email,
            password,
            csrfToken,
            callbackUrl: '/dashboard',
            json: true,
          },
          form: true,
          followRedirect: false,
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 302])

          // Extract and manually set the session cookie from response headers
          const setCookieHeader = response.headers['set-cookie']

          if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader)
              ? setCookieHeader
              : [setCookieHeader]

            // Find and set ALL NextAuth session cookies (including chunked cookies)
            cookies.forEach((cookie) => {
              // NextAuth session cookies contain 'session-token' (may be chunked as .0, .1, etc.)
              if (cookie.includes('session-token')) {
                const firstPart = cookie.split(';')[0]
                if (firstPart) {
                  const [name, value] = firstPart.split('=')
                  if (name && value) {
                    cy.setCookie(name, value)
                  }
                }
              }
            })
          }
        })
      })
    },
    {
      validate() {
        // Verify session is still valid by checking the session endpoint
        // Note: We can't check for specific cookie names because NextAuth may use
        // cookie chunking (authjs.session-token.0, .1, etc.) for large sessions
        cy.request('/api/auth/session').then((response) => {
          expect(response.body).to.have.property('user')
        })
      },
    }
  )
})

/**
 * Clear all sessions and cookies
 * Useful for testing logged-out states
 */
Cypress.Commands.add('logout', () => {
  cy.clearCookies()
  cy.clearLocalStorage()
})

/**
 * Intercept GraphQL requests by operation name
 * Allows mocking or modifying specific GraphQL operations
 *
 * @param intercepts - Array of intercept configurations
 *
 * @example
 * // Mock a query response
 * cy.interceptGraphql([{
 *   operationName: 'GuessesByOwner',
 *   reply: { body: { data: { guessesByOwner: { items: [] } } } }
 * }])
 *
 * @example
 * // Spy on a mutation and modify response
 * cy.interceptGraphql([{
 *   operationName: 'CreateGuess',
 *   alias: 'createGuess',
 *   continue: (res) => { res.body.data.createGuess.id = 'modified-id' }
 * }])
 */
Cypress.Commands.add('interceptGraphql', (intercepts: GraphQLIntercept[]) => {
  cy.intercept('POST', '/api/graphql', (req) => {
    const matchingIntercept = intercepts.find(
      (intercept) => req.body.operationName === intercept.operationName
    )

    if (matchingIntercept) {
      req.alias = matchingIntercept.alias ?? matchingIntercept.operationName

      if (matchingIntercept.reply) {
        req.reply(matchingIntercept.reply)
      } else if (matchingIntercept.continue) {
        req.continue(matchingIntercept.continue)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/**
 * Configuration for intercepting a GraphQL operation
 */
interface GraphQLIntercept {
  /** The GraphQL operation name to match */
  operationName: string
  /** Optional alias for cy.wait('@alias') */
  alias?: string
  /** Static response to return (mocks the request) */
  reply?: {
    body?: Record<string, unknown>
    statusCode?: number
    headers?: Record<string, string>
    delay?: number
  }
  /** Callback to modify the response (spies and modifies) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  continue?: (response: any) => void
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Select element by data-testid attribute
       * @param testId - The value of the data-testid attribute
       * @example cy.getByTestId('signin-email')
       */
      getByTestId(
        testId: string,
        options?: Partial<Cypress.Timeoutable>
      ): Chainable<JQuery<HTMLElement>>

      /**
       * Programmatic login via NextAuth API
       * @param email - User email
       * @param password - User password
       * @example cy.loginByApi('user@example.com', 'password123')
       */
      loginByApi(email: string, password: string): Chainable<void>

      /**
       * Clear all sessions and cookies
       * @example cy.logout()
       */
      logout(): Chainable<void>

      /**
       * Intercept GraphQL requests by operation name
       * @param intercepts - Array of intercept configurations
       * @example cy.interceptGraphql([{ operationName: 'GuessesByOwner', reply: { data: { guessesByOwner: { items: [] } } } }])
       */
      interceptGraphql(intercepts: GraphQLIntercept[]): Chainable<null>
    }
  }
}

export {}
