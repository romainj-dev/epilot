import { AuthTabs } from './AuthTabs'

describe('AuthTabs Component', () => {
  it('should render with sign-in tab active by default', () => {
    cy.mount(<AuthTabs />)

    cy.getByTestId('tab-signin').should('have.attr', 'data-state', 'active')
    cy.getByTestId('tab-signup').should('have.attr', 'data-state', 'inactive')
    cy.getByTestId('tab-content-signin').should('be.visible')
    cy.getByTestId('tab-content-signup').should('not.be.visible')
  })

  it('should switch between tabs and clear errors', () => {
    cy.mount(<AuthTabs />)

    // Trigger an error in sign-up tab
    cy.getByTestId('tab-signup').click()
    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('mismatch123')
    cy.getByTestId('signup-submit').click()

    // Error should appear
    cy.getByTestId('auth-error').should('exist')

    // Switch to sign-up tab
    cy.getByTestId('tab-signin').click()
    cy.getByTestId('tab-content-signin').should('be.visible')

    // Error should be cleared
    cy.getByTestId('auth-error').should('not.exist')
  })

  it('should handle consecutive errors in signup tab', () => {
    cy.mount(<AuthTabs />)

    cy.getByTestId('tab-signup').click()

    // Error 1: Password mismatch
    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('mismatch123')
    cy.getByTestId('signup-submit').click()

    cy.getByTestId('auth-error').should('contain', 'Passwords do not match')

    // Error 2: Password too short
    cy.getByTestId('signup-password').clear().type('short')
    cy.getByTestId('signup-confirm').clear().type('short')
    cy.getByTestId('signup-submit').click()

    cy.getByTestId('auth-error').should(
      'contain',
      'Password must be at least 8 characters'
    )

    // Clear error by switching tabs
    cy.getByTestId('tab-signin').click()
    cy.getByTestId('auth-error').should('not.exist')

    // Switch back and trigger Error 3
    cy.getByTestId('tab-signup').click()
    // Error 3: Password mismatch
    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('mismatch123')
    cy.getByTestId('signup-submit').click()

    cy.getByTestId('auth-error').should('contain', 'Passwords do not match')
  })

  it('should redirect to sign-in tab after successful signup confirmation', () => {
    cy.intercept('POST', '/api/cognito/signup', {
      statusCode: 200,
      body: { success: true },
    }).as('signupRequest')

    cy.intercept('POST', '/api/cognito/confirm', {
      statusCode: 200,
      body: { success: true },
    }).as('confirmRequest')

    cy.mount(<AuthTabs />)

    // Switch to signup tab
    cy.getByTestId('tab-signup').click()
    cy.getByTestId('tab-content-signup').should('be.visible')

    // Complete signup
    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('password123')
    cy.getByTestId('signup-submit').click()

    cy.wait('@signupRequest')

    // Confirm email
    cy.getByTestId('signup-code').type('123456')
    cy.getByTestId('signup-submit').click()

    cy.wait('@confirmRequest')

    // Should automatically switch to sign-in tab
    cy.getByTestId('tab-content-signin').should('be.visible')
  })
})
