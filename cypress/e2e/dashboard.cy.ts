/**
 * E2E Tests: Dashboard Accessibility
 *
 * Tests the dashboard page for accessibility violations using axe-core.
 * This ensures the entire authenticated dashboard experience meets WCAG standards.
 *
 * @see cypress/README.md for setup instructions
 */

import { logViolations } from '../utils/axe'

describe('Dashboard Accessibility', () => {
  const TEST_USER_EMAIL = Cypress.env('TEST_USER_EMAIL')
  const TEST_USER_PASSWORD = Cypress.env('TEST_USER_PASSWORD')
  beforeEach(() => {
    cy.loginByApi(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    cy.visit('/dashboard')
    cy.getByTestId('price-value').should('exist')
  })

  it('has no detectable accessibility violations', () => {
    // Inject axe-core accessibility testing library
    cy.injectAxe()

    // Check the entire page for accessibility violations
    cy.checkA11y(undefined, undefined, logViolations)
  })
})
