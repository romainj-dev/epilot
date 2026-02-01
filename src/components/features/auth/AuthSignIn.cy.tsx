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
      body: { success: true },
    }).as('providersRequest')

    cy.mount(<AuthSignIn setError={setError} />)

    cy.getByTestId('signin-email').type('test@example.com')
    cy.getByTestId('signin-password').type('password123')

    cy.getByTestId('signin-submit').click()

    // Next auth providers request
    cy.wait('@providersRequest')

    // Nextauth redirect
    cy.url().should('include', '/api/auth/signin')
  })
})
