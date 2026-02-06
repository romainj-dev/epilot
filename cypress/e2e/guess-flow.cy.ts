/**
 * E2E Tests: Core Game Loop (Guess Flow)
 *
 * Tests the main game functionality with REAL API calls.
 *
 * IMPORTANT CONSTRAINTS:
 * - A user can only have ONE active guess at a time
 * - Active guesses settle after 60 seconds (accept the wait)
 *
 * PREREQUISITE:
 * - The test user must NOT have an active guess when the test starts
 * - If an active guess exists, the test will fail immediately
 *
 * @see cypress/README.md for setup instructions
 */

describe('Core Game Loop - Guess Flow', () => {
  const TEST_USER_EMAIL = Cypress.env('TEST_USER_EMAIL')
  const TEST_USER_PASSWORD = Cypress.env('TEST_USER_PASSWORD')

  beforeEach(() => {
    cy.loginByApi(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    cy.visit('/dashboard')

    // Wait for price to be loaded (not just the element, but actual value)
    cy.getByTestId('price-value')
      .invoke('text')
      .should('match', /\$[\d,]+\.\d{2}/)

    // Precondition: No active guess should exist
    cy.getByTestId('guess-active').should(($el) => {
      expect(
        $el,
        'Precondition failed: No active guess should exist. Wait ~60s for settlement or use a different test user.'
      ).to.have.length(0)
    })
  })

  it('should allow making a prediction and display active state correctly', () => {
    // Intercept CreateGuess mutation to capture the entry price
    cy.interceptGraphql([
      {
        operationName: 'CreateGuess',
        alias: 'createGuess',
      },
    ])

    // Verify buttons are enabled
    cy.getByTestId('guess-up').should('be.visible').and('not.be.disabled')
    cy.getByTestId('guess-down').should('be.visible').and('not.be.disabled')

    // Verify no active prediction card is shown
    cy.getByTestId('guess-active').should('not.exist')

    // Capture current price for later verification
    cy.getByTestId('price-value')
      .invoke('text')
      .should('match', /\$[\d,]+\.\d{2}/)

    // WHEN: User makes an UP prediction
    cy.getByTestId('guess-up').click()

    // Capture the entry price from the mutation
    cy.wait('@createGuess')
      .its('request.body.variables.input.startPrice')
      .as('entryPrice')

    // THEN: Active prediction card should appear
    cy.getByTestId('guess-active').should('be.visible')

    // Countdown should be visible
    cy.getByTestId('guess-countdown')
      .should('be.visible')
      .invoke('text')
      .should('match', /\d+/)

    // Both buttons should now be disabled
    cy.getByTestId('guess-up').should('be.disabled')
    cy.getByTestId('guess-down').should('be.disabled')

    // Active card should contain expected elements
    cy.getByTestId('guess-active').within(() => {
      // Should show the direction
      cy.contains(/UP/i).should('be.visible')
      // Should show entry price (contains $)
      cy.contains('$').should('be.visible')
    })

    // Verify countdown decreases over time (wait 2 seconds)
    cy.getByTestId('guess-countdown')
      .invoke('text')
      .then((initialText) => {
        const initialSeconds = parseInt(initialText.match(/\d+/)?.[0] || '0')

        // Wait 2 seconds
        cy.wait(2000)

        cy.getByTestId('guess-countdown')
          .invoke('text')
          .then((newText) => {
            const newSeconds = parseInt(newText.match(/\d+/)?.[0] || '0')
            expect(newSeconds).to.be.lessThan(initialSeconds)
          })
      })

    // Verify state persists after page refresh
    cy.reload()
    cy.getByTestId('price-value').should('exist')

    // Active prediction should still be visible
    cy.getByTestId('guess-active').should('be.visible')
    cy.getByTestId('guess-up').should('be.disabled')
    cy.getByTestId('guess-down').should('be.disabled')

    cy.wait(60000)

    // Increase timeout due to latency of the guess settlement > DDB update > SSE stream
    cy.getByTestId('guess-active', { timeout: 60000 }).should('not.exist')
    cy.getByTestId('guess-up').should('be.enabled')
    cy.getByTestId('guess-down').should('be.enabled')

    // Verify the guess is settled and appears in history with correct entry price
    cy.get<number>('@entryPrice').then((entryPrice) => {
      const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(entryPrice)

      // First row in history table should have the entry price
      cy.getByTestId('guess-history-desktop')
        .find('table tbody tr')
        .first()
        .should('contain.text', formattedPrice)
    })
  })
})
