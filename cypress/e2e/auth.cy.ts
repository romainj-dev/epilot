/**
 * E2E Tests: Authentication Flow
 *
 * Tests the sign-in flow including:
 * - Successful authentication with valid credentials
 * - Error handling for invalid credentials
 * - Redirect behavior after successful login
 *
 * @see cypress/README.md for setup instructions
 */

describe('Authentication Flow', () => {
  const TEST_USER_EMAIL = Cypress.env('TEST_USER_EMAIL')
  const TEST_USER_PASSWORD = Cypress.env('TEST_USER_PASSWORD')

  describe('Sign In - Valid Credentials', () => {
    beforeEach(() => {
      // Clear any existing sessions
      cy.logout()

      // Visit the auth page
      cy.visit('/auth')
    })

    it('should successfully sign in and redirect to dashboard', () => {
      // Verify we're on the auth page
      cy.url().should('include', '/auth')

      // Fill in the sign-in form
      cy.getByTestId('signin-email').should('be.visible').type(TEST_USER_EMAIL)

      cy.getByTestId('signin-password')
        .should('be.visible')
        .type(TEST_USER_PASSWORD)

      // Submit the form
      cy.getByTestId('signin-submit')
        .should('be.visible')
        .should('not.be.disabled')
        .click()

      // Wait for redirect to dashboard
      cy.url().should('include', '/dashboard', { timeout: 10000 })

      // Verify we're authenticated by checking for dashboard content
      cy.getByTestId('price-value').should('exist')
    })

    it('should persist session after page reload', () => {
      // Sign in first
      cy.getByTestId('signin-email').type(TEST_USER_EMAIL)
      cy.getByTestId('signin-password').type(TEST_USER_PASSWORD)
      cy.getByTestId('signin-submit').click()

      // Wait for dashboard
      cy.url().should('include', '/dashboard', { timeout: 10000 })

      // Reload the page
      cy.reload()

      // Should still be on dashboard (not redirected to auth)
      cy.url().should('include', '/dashboard')
      cy.getByTestId('price-value').should('exist')
    })
  })

  describe('Sign In - Invalid Credentials', () => {
    beforeEach(() => {
      // Clear any existing sessions
      cy.logout()

      // Visit the auth page
      cy.visit('/auth')
    })
    it('should show error message and stay on page for invalid email', () => {
      // Fill in with invalid credentials
      cy.getByTestId('signin-email').type('invalid@example.com')
      cy.getByTestId('signin-password').type('WrongPassword123!')

      // Submit the form
      cy.getByTestId('signin-submit').click()

      // Should show error message
      cy.getByTestId('auth-error')
        .should('be.visible')
        .and('contain.text', 'Invalid')

      // Should remain on auth page
      cy.url().should('include', '/auth')
    })
  })

  describe('Protected Routes', () => {
    beforeEach(() => {
      // Clear any existing sessions
      cy.logout()
    })

    it('should redirect to auth page when accessing dashboard without authentication', () => {
      // Try to visit dashboard directly
      cy.visit('/dashboard')

      // Should be redirected to auth page
      cy.url().should('include', '/auth')
    })
  })
})
