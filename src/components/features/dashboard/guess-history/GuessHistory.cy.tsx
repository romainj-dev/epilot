import { GuessHistory } from './GuessHistory'
import {
  GuessDirection,
  GuessStatus,
  GuessOutcome,
  type Guess,
} from '@/graphql/generated/graphql'

describe('GuessHistory Component', () => {
  it('should show empty state when no predictions exist', () => {
    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: [],
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.contains('No predictions yet. Place your first guess!').should(
      'be.visible'
    )
    cy.getByTestId('guess-history-mobile').should('not.exist')
    cy.getByTestId('guess-history-desktop').should('not.exist')
  })

  it('should display guess history DESKTOP table with correct data', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-1',
        owner: 'test-user-id',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Win,
        startPrice: 98000.0,
        endPrice: 98500.0,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'guess-2',
        owner: 'test-user-id',
        direction: GuessDirection.Down,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Loss,
        startPrice: 99000.0,
        endPrice: 99500.0,
        settleAt: new Date(Date.now() - 7200000).toISOString(),
        createdAt: new Date(Date.now() - 7260000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('guess-history-desktop').within(() => {
      cy.contains('th', 'Direction').should('be.visible')
      cy.contains('th', 'Entry').should('be.visible')
      cy.contains('th', 'Resolved').should('be.visible')
      cy.contains('th', 'Result').should('be.visible')
      cy.contains('th', 'Time').should('be.visible')

      // First row (WIN)
      cy.contains('UP').should('be.visible')
      cy.contains('$98,000.00').should('be.visible')
      cy.contains('$98,500.00').should('be.visible')
      cy.contains('Win').should('be.visible')

      // Second row (LOSS)
      cy.contains('DOWN').should('be.visible')
      cy.contains('$99,000.00').should('be.visible')
      cy.contains('$99,500.00').should('be.visible')
      cy.contains('Loss').should('be.visible')
    })
  })

  it('should display guess history MOBILE table with correct data', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-1',
        owner: 'test-user-id',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Win,
        startPrice: 98000.0,
        endPrice: 98500.0,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'guess-2',
        owner: 'test-user-id',
        direction: GuessDirection.Down,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Loss,
        startPrice: 99000.0,
        endPrice: 99500.0,
        settleAt: new Date(Date.now() - 7200000).toISOString(),
        createdAt: new Date(Date.now() - 7260000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.viewport(375, 812)
    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('guess-history-mobile').within(() => {
      // First row (WIN)
      cy.contains('UP').should('be.visible')
      cy.contains('$98,000.00').should('be.visible')
      cy.contains('$98,500.00').should('be.visible')

      cy.contains('DOWN').should('be.visible')
      cy.contains('$99,000.00').should('be.visible')
      cy.contains('$99,500.00').should('be.visible')
    })
  })

  it('should show Load More button when nextToken is present', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-1',
        owner: 'test-user-id',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Win,
        startPrice: 98000.0,
        endPrice: 98500.0,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: 'next-page-token',
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('load-more-button').should('be.visible')
    cy.getByTestId('load-more-button').should('contain', 'Load More')
  })

  it('should not show Load More button when nextToken is null', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-1',
        owner: 'test-user-id',
        direction: GuessDirection.Up,
        status: GuessStatus.Settled,
        outcome: GuessOutcome.Win,
        startPrice: 98000.0,
        endPrice: 98500.0,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('load-more-button').should('not.exist')
  })

  it('should display FAILED guess in DESKTOP table with correct data', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-failed',
        owner: 'test-user-id',
        direction: GuessDirection.Up,
        status: GuessStatus.Failed,
        outcome: null,
        startPrice: 98000.0,
        endPrice: null,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('guess-history-desktop').within(() => {
      cy.contains('UP').should('be.visible')
      cy.contains('$98,000.00').should('be.visible')
      cy.contains('Failed').should('be.visible')
    })
  })

  it('should display FAILED guess in MOBILE view with correct data', () => {
    const mockGuesses: Guess[] = [
      {
        id: 'guess-failed',
        owner: 'test-user-id',
        direction: GuessDirection.Down,
        status: GuessStatus.Failed,
        outcome: null,
        startPrice: 99000.0,
        endPrice: null,
        settleAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3660000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: mockGuesses,
              nextToken: null,
            },
          },
        })
      }
    }).as('listGuessHistory')

    cy.viewport(375, 812)
    cy.mount(<GuessHistory />)

    cy.wait('@listGuessHistory')

    cy.getByTestId('guess-history-mobile').within(() => {
      cy.contains('DOWN').should('be.visible')
      cy.contains('$99,000.00').should('be.visible')
    })
  })

  describe('Accessibility', () => {
    it('has no detectable a11y violations', () => {
      const mockGuesses: Guess[] = [
        {
          id: 'guess-1',
          owner: 'test-user-id',
          direction: GuessDirection.Up,
          status: GuessStatus.Settled,
          outcome: GuessOutcome.Win,
          startPrice: 98000.0,
          endPrice: 98500.0,
          settleAt: new Date(Date.now() - 3600000).toISOString(),
          createdAt: new Date(Date.now() - 3660000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ]

      cy.intercept('POST', '/api/graphql', (req) => {
        if (req.body.operationName === 'GuessesByOwner') {
          req.reply({
            data: {
              guessesByOwner: {
                items: mockGuesses,
                nextToken: null,
              },
            },
          })
        }
      }).as('listGuessHistory')

      cy.mount(<GuessHistory />)
      cy.wait('@listGuessHistory')

      cy.injectAxe()
      cy.checkA11y('[data-testid="guess-history"]')
    })
  })
})
