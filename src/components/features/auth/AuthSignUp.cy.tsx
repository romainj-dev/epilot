import { AuthSignUp } from './AuthSignUp'

describe('AuthSignUp Component', () => {
  it('should render all form fields with correct structure', () => {
    const setError = cy.stub()
    const onConfirmed = cy.stub()

    cy.mount(<AuthSignUp setError={setError} onConfirmed={onConfirmed} />)

    cy.getByTestId('signup-email').should('exist')
    cy.getByTestId('signup-password').should('exist')
    cy.getByTestId('signup-confirm').should('exist')
    cy.getByTestId('signup-submit').should('contain', 'Create account')

    // Confirmation code input should NOT exist initially
    cy.getByTestId('signup-code').should('not.exist')
  })

  it('should show validation errors for password mismatch and too short password', () => {
    const setError = cy.stub().as('setError')
    const onConfirmed = cy.stub()

    cy.mount(<AuthSignUp setError={setError} onConfirmed={onConfirmed} />)

    // Test password mismatch
    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('pass123')
    cy.getByTestId('signup-confirm').type('different123')
    cy.getByTestId('signup-submit').click()

    cy.get('@setError').should('have.been.calledWith', 'Passwords do not match')

    // Test password too short
    cy.getByTestId('signup-password').clear().type('short')
    cy.getByTestId('signup-confirm').clear().type('short')
    cy.getByTestId('signup-submit').click()

    cy.get('@setError').should(
      'have.been.calledWith',
      'Password must be at least 8 characters'
    )
  })

  it('should show confirmation code input after successful signup', () => {
    const setError = cy.stub()
    const onConfirmed = cy.stub()

    cy.intercept('POST', '/api/cognito/signup', {
      statusCode: 200,
      body: { success: true },
    }).as('signupRequest')

    cy.mount(<AuthSignUp setError={setError} onConfirmed={onConfirmed} />)

    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('password123')
    cy.getByTestId('signup-submit').click()

    cy.wait('@signupRequest')

    cy.getByTestId('signup-status-message').should(
      'contain',
      'Check your email for the confirmation code'
    )
    cy.getByTestId('signup-submit').should('contain', 'Confirm email')
    cy.getByTestId('signup-code').should('be.visible')

    // Form fields should be disabled during confirmation
    cy.getByTestId('signup-email').should('be.disabled')
    cy.getByTestId('signup-password').should('be.disabled')
    cy.getByTestId('signup-confirm').should('be.disabled')
  })

  it('should call onConfirmed after successful confirmation', () => {
    const setError = cy.stub()
    const onConfirmed = cy.stub().as('onConfirmed')

    cy.intercept('POST', '/api/cognito/signup', {
      statusCode: 200,
      body: { success: true },
    }).as('signupRequest')

    cy.intercept('POST', '/api/cognito/confirm', {
      statusCode: 200,
      body: { success: true },
    }).as('confirmRequest')

    cy.mount(<AuthSignUp setError={setError} onConfirmed={onConfirmed} />)

    cy.getByTestId('signup-email').type('test@example.com')
    cy.getByTestId('signup-password').type('password123')
    cy.getByTestId('signup-confirm').type('password123')
    cy.getByTestId('signup-submit').click()

    cy.wait('@signupRequest')

    cy.getByTestId('signup-code').type('valid-code')
    cy.getByTestId('signup-submit').click()

    cy.wait('@confirmRequest')

    cy.get('@onConfirmed').should('have.been.called')
  })
})
