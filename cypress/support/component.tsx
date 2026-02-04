// ***********************************************************
// Component Testing Support File
// ***********************************************************

// Import custom commands (getByTestId, etc.)
import './commands'

// Import global styles for proper styling in component tests
import '../../src/app/globals.css'

// Import mount from @cypress/react package
import { mount } from '@cypress/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ReactNode } from 'react'
import type { Session } from 'next-auth'

// Import English messages
import messages from '../../messages/en.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MountOptions {
  session?: Session | null
  locale?: string
  router?: Partial<AppRouterInstance>
}

// ---------------------------------------------------------------------------
// Default Test Session
// ---------------------------------------------------------------------------

const DEFAULT_TEST_SESSION: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
}

// ---------------------------------------------------------------------------
// Mock Router for Next.js App Router
// ---------------------------------------------------------------------------

function createMockRouter(
  overrides: Partial<AppRouterInstance> = {}
): AppRouterInstance {
  return {
    push: cy.stub().as('router.push'),
    replace: cy.stub().as('router.replace'),
    prefetch: cy.stub().as('router.prefetch'),
    back: cy.stub().as('router.back'),
    forward: cy.stub().as('router.forward'),
    refresh: cy.stub().as('router.refresh'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// AllProviders Wrapper
// ---------------------------------------------------------------------------

interface AllProvidersProps {
  children: ReactNode
  session: Session | null
  locale: string
  router: AppRouterInstance
}

function AllProviders({
  children,
  session,
  locale,
  router,
}: AllProvidersProps) {
  // Create a fresh QueryClient for each test with minimal config
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry in tests
        gcTime: 0, // Don't cache in tests (formerly cacheTime)
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <AppRouterContext.Provider value={router}>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </QueryClientProvider>
      </SessionProvider>
    </AppRouterContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Custom Mount Command
// ---------------------------------------------------------------------------

/**
 * Custom mount command for component testing
 * Wraps components with necessary providers (Session, QueryClient, NextIntl)
 *
 * @param component - React component to mount
 * @param options - Mount options (session, locale)
 * @returns Cypress chainable
 *
 * @example
 * ```tsx
 * mount(<Button>Click me</Button>)
 * mount(<Button>Click me</Button>, { session: null }) // No session
 * mount(<Button>Click me</Button>, { locale: 'fr' })
 * ```
 */
export function mountWithProviders(
  component: ReactNode,
  options: MountOptions = {}
) {
  const {
    session = DEFAULT_TEST_SESSION,
    locale = 'en',
    router: routerOverrides,
  } = options
  const router = createMockRouter(routerOverrides)

  return mount(
    <AllProviders session={session} locale={locale} router={router}>
      {component}
    </AllProviders>
  )
}

// Augment Cypress namespace to include custom mount command
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mount: typeof mountWithProviders
    }
  }
}

// Add custom mount command to Cypress
Cypress.Commands.add('mount', mountWithProviders)

// TODO: Make this configurable
const SHOULD_STUB_REQUESTS = false

beforeEach(() => {
  cy.window().then(() => {
    // Check if all requests should be stubbed in CI
    // Fails the test if a query is not mocked
    cy.intercept('/api/**', (req) => {
      const url = req.url
      const opName = req.body?.operationName

      if (SHOULD_STUB_REQUESTS) {
        throw new Error(
          `❌ Unmocked API call detected - ` +
            `${opName ? `GraphQL Operation: ${opName}\n` : `URL: ${url}\n`}` +
            `All API calls must be mocked in CI.`
        )
      } else {
        Cypress.log({
          name: '⚠️ Warning',
          displayName: '⚠️ Unmocked API call detected',
          message: opName ? `GraphQL: ${opName}` : `URL: ${url}`,
          consoleProps: () => ({
            'Operation Name': opName || 'N/A',
            URL: url,
            Note: 'All API calls must be mocked in CI',
          }),
        })
      }
    })
  })
})
