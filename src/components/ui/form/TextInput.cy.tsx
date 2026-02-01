import { TextInput } from './TextInput'

/**
 * Only test the override made from the base input component
 */
describe('TextInput Component', () => {
  it('should render label linked to input and display hint text', () => {
    cy.mount(
      <TextInput
        id="test-input"
        label="Email Address"
        hint="We'll never share your email"
        placeholder="Enter your email"
      />
    )

    cy.getByTestId('test-input-label')
      .should('contain', 'Email Address')
      .and('have.attr', 'for', 'test-input')

    cy.getByTestId('test-input')
      .should('exist')
      .and('have.attr', 'placeholder', 'Enter your email')

    cy.getByTestId('test-input-hint').should(
      'contain',
      "We'll never share your email"
    )
  })
})
