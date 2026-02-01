import { Button } from './Button'

/**
 * Only test the override made from the base button component
 */
describe('Button Component', () => {
  it('should show loading spinner and hide content when isLoading is true', () => {
    cy.mount(<Button isLoading={true}>Submit</Button>)

    cy.getByTestId('button-loading').should('exist')
    cy.contains('Submit').should('exist')
  })

  it('should handle asChild with isLoading correctly', () => {
    cy.mount(
      <Button asChild isLoading={true}>
        <a href="/test">Link Button</a>
      </Button>
    )

    cy.get('a[href="/test"]').should('exist')
    cy.getByTestId('button-loading').should('exist')
    cy.contains('Link Button').should('exist')
  })
})
