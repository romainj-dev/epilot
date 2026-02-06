# Testing Strategy

Pragmatic, risk-based approach focused on the **core game loop** (price snapshots → guesses → settlement → score).

- **Fast feedback**: Unit tests run locally with mocked I/O
- **High confidence**: Integration tests hit real AWS services
- **Focused UI coverage**: Component tests for critical UI, E2E for critical paths only

## Testing Pyramid

| Layer           | Scope                         | I/O      | Status                   |
| --------------- | ----------------------------- | -------- | ------------------------ |
| **Unit**        | Lambdas, BFF routes, FE logic | Mocked   | ✅ Backend / Frontend |
| **Component**   | Critical UI components        | Mocked   | ✅                       |
| **Integration** | AWS services wiring           | Real AWS | ✅                       |
| **E2E**         | User journeys (1-2 paths)     | Real API | ✅                       |

## Commands

```bash
# Unit tests
pnpm test                # All unit tests (Lambda + BFF + web)
pnpm test:bff            # BFF only
pnpm test:amplify:unit   # Lambda only

# Integration tests
pnpm test:amplify:int    # AWS smoke tests (real AWS)

# Component tests
pnpm cypress:open --component   # Interactive
pnpm cypress:component          # Headless

# E2E tests
pnpm cypress:open        # Interactive
pnpm cypress:e2e         # Headless
```

---

## Backend Unit Tests (Jest)

**All I/O mocked** — fast, deterministic, no network calls.

### Lambda Functions

- **Location**: `amplify/backend/function/*/src/__tests__/*.unit.test.js`
- **Scope**: Business logic, request/response shaping, error handling
- **Mocked**: AWS SDK, AppSync client, external APIs (CoinGecko)
- **Run**: `pnpm test:amplify:unit`

### BFF Routes (Next.js API)

- **Location**: `src/app/api/**/*.test.ts`
- **Scope**: Auth gating, request validation, error mapping, SSE relay lifecycle
- **Mocked**: Upstream GraphQL, auth session
- **Run**: `pnpm test:bff`

---

## Integration Tests (Jest + Real AWS)

**Hits real AWS services** — validates wiring across AppSync, Cognito, Lambda, DynamoDB, EventBridge.

- **Location**: `amplify/backend/__tests__/integration/*.int.test.ts`
- **Scope**: CRUD flows, Lambda invocation, auth modes (API key vs Cognito)
- **Run**: `pnpm test:amplify:int`

### Prerequisites

- Deployed Amplify backend (`amplify push`)
- SSM parameters seeded (see `SETUP.MD`)
- AWS credentials with Cognito admin + Lambda invoke permissions
- Cognito app client with `USER_PASSWORD_AUTH` enabled

### Configuration

Env vars (preferred) or Amplify outputs fallback:

```bash
AWS_REGION, APPSYNC_ENDPOINT, APPSYNC_API_KEY
COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID
LAMBDA_*_ARN  # Post-confirmation, price-snapshot, schedule, settle
```

---

## Frontend Unit Tests (Jest) — Planned

**All I/O mocked** — tests pure logic in isolation.

- **Location**: `src/**/*.test.ts`
- **Scope**: Utility functions, formatters, validation logic, custom hooks (non-rendering)
- **Run**: `pnpm test:fe` _(planned)_

---

## Component Tests (Cypress)

**Mocked providers** — tests component behavior in isolation.

- **Location**: Co-located with components (`src/components/**/*.cy.tsx`)
- **Scope**: Critical components (auth forms, guess actions, history table)
- **Approach**: Mount with stubbed session/query providers, verify UI states and interactions
- **Run**: `pnpm cypress:open --component` (interactive) or `pnpm cypress:component` (headless)

---

## E2E Tests (Cypress)

**Real API calls** — validates critical user journeys end-to-end.

- **Location**: `cypress/e2e/*.cy.ts`
- **Scope**: Auth happy path, full guess lifecycle (create → settlement → history)
- **Run**: `pnpm cypress:open` or `pnpm cypress:e2e`

### Setup

1. **Create test user** defined in cypress.config.ts
2. Start dev server: `pnpm dev`
3. Run Cypress: `pnpm cypress:open`

### Conventions

- **Fail-fast**: Preconditions checked early (e.g., no active guess)
- **No mocking**: Real Cognito auth, real AppSync calls
- **Intercept for capture**: `cy.interceptGraphql()` captures request data for assertions

See `cypress/README.md` for details.
