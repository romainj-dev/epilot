import { GuessAction } from './GuessAction'
import { MockPriceSnapshotProvider } from '@/components/features/price-snapshot/PriceSnapshotProvider'
import type { PriceSnapshotStream } from '@/types/price-snapshot'
import { GuessDirection, GuessStatus } from '@/graphql/generated/graphql'

describe('GuessAction Component', () => {
  it('should show initial state with UP/DOWN buttons enabled and hint', () => {
    const mockSnapshot: PriceSnapshotStream = {
      id: 'test-snapshot-1',
      pk: 'BTCUSD',
      priceUsd: 98765.43,
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
    }

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
    }).as('getActiveGuess')

    cy.mount(
      <MockPriceSnapshotProvider snapshot={mockSnapshot}>
        <GuessAction />
      </MockPriceSnapshotProvider>
    )

    cy.wait('@getActiveGuess')

    cy.getByTestId('guess-up').should('not.be.disabled')
    cy.getByTestId('guess-down').should('not.be.disabled')
    cy.contains(
      'Predict whether BTC will be higher or lower in 60 seconds'
    ).should('be.visible')
    cy.getByTestId('guess-active').should('not.exist')
  })

  it('should show active guess card with countdown when guess is pending', () => {
    const mockSnapshot: PriceSnapshotStream = {
      id: 'test-snapshot-1',
      pk: 'BTCUSD',
      priceUsd: 98765.43,
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
    }

    const settleAt = new Date(Date.now() + 60000).toISOString()

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.reply({
          data: {
            guessesByOwner: {
              items: [
                {
                  id: 'active-guess-1',
                  owner: 'test-user-id',
                  direction: GuessDirection.Up,
                  status: GuessStatus.Pending,
                  startPrice: 98000.0,
                  settleAt,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              nextToken: null,
            },
          },
        })
      }
    }).as('getActiveGuess')

    cy.mount(
      <MockPriceSnapshotProvider snapshot={mockSnapshot}>
        <GuessAction />
      </MockPriceSnapshotProvider>
    )

    cy.wait('@getActiveGuess')

    cy.getByTestId('guess-active').should('be.visible')
    cy.getByTestId('guess-countdown').should('be.visible')
    cy.getByTestId('guess-countdown').invoke('text').should('match', /\d+s/)

    cy.getByTestId('guess-up').should('be.disabled')
    cy.getByTestId('guess-down').should('be.disabled')
  })

  it('should disable buttons when price snapshot is null', () => {
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
    }).as('getActiveGuess')

    cy.mount(
      <MockPriceSnapshotProvider snapshot={null}>
        <GuessAction />
      </MockPriceSnapshotProvider>
    )

    cy.wait('@getActiveGuess')

    cy.getByTestId('guess-up').should('be.disabled')
    cy.getByTestId('guess-down').should('be.disabled')
  })

  it('should call create guess mutation when user clicks UP button', () => {
    const mockSnapshot: PriceSnapshotStream = {
      id: 'test-snapshot-1',
      pk: 'BTCUSD',
      priceUsd: 98765.43,
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
    }

    cy.intercept('POST', '/api/graphql', (req) => {
      if (req.body.operationName === 'GuessesByOwner') {
        req.alias = 'getActiveGuess'
        req.reply({
          data: {
            guessesByOwner: {
              items: [],
              nextToken: null,
            },
          },
        })
      } else if (req.body.operationName === 'CreateGuess') {
        req.alias = 'createGuess'
        req.reply({
          data: {
            createGuess: {
              id: 'test-guess-1',
              owner: 'test-user-id',
              direction: req.body.variables.input.direction,
              settleAt: req.body.variables.input.settleAt,
              status: req.body.variables.input.status,
              startPrice: req.body.variables.input.startPrice,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        })
      }
    })

    cy.mount(
      <MockPriceSnapshotProvider snapshot={mockSnapshot}>
        <GuessAction />
      </MockPriceSnapshotProvider>
    )

    cy.wait('@getActiveGuess')

    cy.getByTestId('guess-up').click()

    cy.wait('@createGuess').then((interception) => {
      const input = interception.request.body.variables.input

      // Validate structure and static values
      expect(input.direction).to.equal(GuessDirection.Up)
      expect(input.status).to.equal(GuessStatus.Pending)
      expect(input.startPrice).to.equal(98765.43)
      // Validate settleAt is approximately 60 seconds in the future
      const expectedSettleAt = Date.now() + 60000
      expect(new Date(input.settleAt).getTime()).to.be.within(
        expectedSettleAt - 500,
        expectedSettleAt + 500
      )
    })
  })
})
