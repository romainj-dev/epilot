import { PriceTickerBig } from './PriceTickerBig'
import { MockPriceSnapshotProvider } from './PriceSnapshotProvider'
import type { PriceSnapshotStream } from '@/types/price-snapshot'

describe('PriceTickerBig Component', () => {
  it('should show loading state when snapshot is null', () => {
    cy.mount(
      <MockPriceSnapshotProvider snapshot={null}>
        <PriceTickerBig />
      </MockPriceSnapshotProvider>
    )

    cy.getByTestId('price-value')
      .should('contain', 'Loading...')
      .and('not.be.visible')
  })

  it('should display formatted price and trend direction icon UP', () => {
    const mockSnapshot: PriceSnapshotStream = {
      id: 'test-snapshot-1',
      pk: 'BTCUSD',
      priceUsd: 98765.43,
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
    }

    // Test UP trend
    cy.mount(
      <MockPriceSnapshotProvider snapshot={mockSnapshot} priceDirection="up">
        <PriceTickerBig />
      </MockPriceSnapshotProvider>
    )

    cy.getByTestId('price-value').should('contain', '$98,765.43')
    cy.getByTestId('price-trend-icon-up').should('exist')
    cy.getByTestId('price-updated-at').should('be.visible')
  })

  it('should display formatted price and trend direction icon DOWN', () => {
    const mockSnapshot: PriceSnapshotStream = {
      id: 'test-snapshot-1',
      pk: 'BTCUSD',
      priceUsd: 98765.43,
      capturedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
    }

    cy.mount(
      <MockPriceSnapshotProvider snapshot={mockSnapshot} priceDirection="down">
        <PriceTickerBig />
      </MockPriceSnapshotProvider>
    )

    cy.getByTestId('price-value').should('contain', '$98,765.43')
    cy.getByTestId('price-trend-icon-down').should('exist')
    cy.getByTestId('price-updated-at').should('be.visible')
  })
})
