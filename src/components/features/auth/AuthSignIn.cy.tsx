import { AuthSignIn } from './AuthSignIn'

describe('AuthSignIn Component', () => {
  it('should render form structure with correct testids', () => {
    const setError = cy.stub()
    cy.mount(<AuthSignIn setError={setError} />)

    cy.getByTestId('signin-email').should('exist')
    cy.getByTestId('signin-password').should('exist')
    cy.getByTestId('signin-submit').should('exist')
  })

  it('should disable submit button when fields are empty', () => {
    const setError = cy.stub()
    cy.mount(<AuthSignIn setError={setError} />)

    cy.getByTestId('signin-submit').should('be.disabled')

    cy.getByTestId('signin-email').type('test@example.com')
    cy.getByTestId('signin-submit').should('be.disabled')

    cy.getByTestId('signin-password').type('password123')
    cy.getByTestId('signin-submit').should('not.be.disabled')
  })

  it('should call signin when form is valid', () => {
    const setError = cy.stub()

    cy.intercept('GET', '/api/auth/providers', {
      statusCode: 200,
      body: { credentials: {} },
    }).as('providersRequest')

    // Mock CSRF token endpoint
    cy.intercept('GET', '/api/auth/csrf', {
      statusCode: 200,
      body: { csrfToken: 'mock-csrf-token' },
    }).as('csrfRequest')

    // Mock the NextAuth signin endpoint (returns success with no error)
    cy.intercept('POST', '/api/auth/signin/credentials*', {
      statusCode: 200,
      body: { ok: true, url: 'http://localhost:8080/dashboard' },
    }).as('signinRequest')

    // Mock session endpoint (called after successful signin)
    cy.intercept('GET', '/api/auth/session', {
      statusCode: 200,
      body: {
        user: { email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
    }).as('sessionRequest')

    cy.mount(<AuthSignIn setError={setError} />)

    cy.getByTestId('signin-email').type('test@example.com')
    cy.getByTestId('signin-password').type('password123')

    cy.getByTestId('signin-submit').click()

    // Wait for NextAuth API calls
    cy.wait('@providersRequest')
    cy.wait('@signinRequest')

    // Verify router.push was called with dashboard route (component uses mocked router)
    cy.get('@router.push').should('have.been.calledWith', '/dashboard')
  })

  describe('Accessibility', () => {
    it('has no detectable a11y violations', () => {
      const setError = cy.stub()

      cy.mount(<AuthSignIn setError={setError} />)

      cy.injectAxe()
      cy.checkA11y('[data-testid="signin-form"]')
    })
  })
})
