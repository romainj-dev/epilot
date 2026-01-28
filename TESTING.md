## Testing Strategy

This project follows a **pragmatic, risk-based** testing approach:

- **Fast feedback by default**: most checks are **local Jest unit tests** (deterministic, no network).
- **High confidence where it matters**: a small set of **AWS integration smoke tests** run against **real AWS** to validate wiring across AppSync, Cognito, Lambdas, DynamoDB, and EventBridge Scheduler.
- **UI testing kept focused** (planned): Jest for **complex logic**, Cypress Component Tests for a **small set of critical components**, and Cypress E2E for **1–2 golden paths** only.

The goal is to prevent regressions in the **core game loop** (price snapshots → guesses → settlement → score) without spending time maintaining broad/flaky end-to-end coverage.

## Testing Pyramid (target mix)

- **Unit tests (majority)**:
  - Backend Lambdas (Jest, mocked I/O)
  - Next.js BFF routes (Jest, mocked I/O)
  - Frontend complex logic (Jest) *(planned)*
- **Integration tests (small but real)**:
  - AWS smoke tests validating CRUD flows + Lambda wiring against real AWS
- **E2E tests (minimal)**:
  - 1–2 critical user journeys *(planned, Cypress E2E)*

## Testing

This repo currently has **Jest-based** tests for:

- **Backend Lambdas (unit)**: local, deterministic, no AWS calls.
- **Next.js BFF routes (unit)**: local, deterministic, no AWS calls.
- **AWS integration smoke tests (Jest)**: run locally but hit **real AWS** (AppSync, Cognito, Lambda, EventBridge Scheduler).

## Commands (current and accurate)

All commands below exist in `package.json` today:

```bash
# All unit tests (Lambda unit + BFF unit)
pnpm test

# Only BFF unit tests (Next.js API routes)
pnpm test:bff

# Only Lambda unit tests (Amplify functions)
pnpm test:amplify:unit

# AWS integration smoke tests (hits real AWS)
pnpm test:amplify:int

# Convenience: runs Lambda unit + integration in parallel
pnpm test:amplify
```

## Unit tests (Jest, local)

### Lambda unit tests (Amplify functions)

- **Location**: `amplify/backend/function/*/src/__tests__/*.unit.test.js`
- **High-level coverage**:
  - **`priceSnapshotJob`**: env/SSM config handling + CoinGecko fetch + AppSync write (all mocked).
  - **`epilotAuthPostConfirmation`**: trigger filtering + AppSync `createUserState` call shaping (mocked).
  - **`scheduleGuessLambda`**: EventBridge Scheduler schedule creation (AWS SDK mocked).
  - **`settleGuessLambda`**: settlement flow when snapshots exist/missing + score update request shape (mocked).
- **Run**:

```bash
pnpm test:amplify:unit
```

### BFF unit tests (Next.js `src/app/api/*`)

- **Location**: `src/app/api/**/*.test.ts`
- **High-level coverage**:
  - **Auth gating** and request validation.
  - **Error shaping/mapping** (GraphQL conventions + route-level error responses).
  - **Relay lifecycle** for the price snapshot SSE stream (upstream subscription is mocked).
- **Run**:

```bash
pnpm test:bff
```

## AWS integration smoke tests (Jest, run locally, hit real AWS)

### What’s covered (high-level)

- **CRUD flows via AppSync**:
  - `PriceSnapshot` CRUD with **API key** auth.
  - `Guess` CRUD with **Cognito userPools (owner)** auth.
  - `UserState` create via **API key** + read/update via **Cognito userPools (owner)** auth.
- **Lambda wiring (invoke real Lambdas)**:
  - `epilotAuthPostConfirmation` → creates `UserState`.
  - `priceSnapshotJob` → creates a `PriceSnapshot` (real CoinGecko call).
  - `scheduleGuessLambda` → creates a one-shot EventBridge Scheduler entry.
  - `settleGuessLambda` → settles a guess and updates the user score.

### Location

- `amplify/backend/__tests__/integration/*.int.test.ts`

### Run

```bash
pnpm test:amplify:int
```

### Requirements / setup

These tests call **real AWS services**, so you need:

- **A deployed Amplify backend** (`amplify init` + `amplify push`).
- **SSM parameters seeded** (see `SETUP.MD`):
  - `/epilot/<env>/appsync-endpoint`
  - `/epilot/<env>/appsync-api-key`
  - `/epilot/<env>/coingecko-api-key`
  - `/epilot/<env>/price-snapshot-enabled`
  - `/epilot/<env>/price-snapshot-interval-seconds`
- **AWS credentials** configured locally (via `aws configure` or env vars) with permissions for:
  - Cognito admin APIs (`AdminCreateUser`, `AdminSetUserPassword`, `AdminDeleteUser`, `AdminGetUser`)
  - `cognito-idp:InitiateAuth`
  - `lambda:InvokeFunction`
- **Cognito app client supports `USER_PASSWORD_AUTH`**:
  - Cognito User Pool → App clients → Authentication flows → enable `ALLOW_USER_PASSWORD_AUTH`
- **Config available via env vars OR Amplify outputs** (env vars take precedence):

```bash
export AWS_REGION=us-east-1
export APPSYNC_ENDPOINT=https://xxxxx.appsync-api.us-east-1.amazonaws.com/graphql
export APPSYNC_API_KEY=da2-xxxxx
export COGNITO_USER_POOL_ID=us-east-1_xxxxx
export COGNITO_CLIENT_ID=xxxxx
export LAMBDA_POST_CONFIRMATION_ARN=arn:aws:lambda:us-east-1:xxxxx:function:epilotAuthPostConfirmation-xxxxx
export LAMBDA_PRICE_SNAPSHOT_JOB_ARN=arn:aws:lambda:us-east-1:xxxxx:function:priceSnapshotJob-xxxxx
export LAMBDA_SCHEDULE_GUESS_ARN=arn:aws:lambda:us-east-1:xxxxx:function:scheduleGuessLambda-xxxxx
export LAMBDA_SETTLE_GUESS_ARN=arn:aws:lambda:us-east-1:xxxxx:function:settleGuessLambda-xxxxx
```

If env vars are not set, the integration tests will try to load:

- `amplify/backend/amplify-meta.json` (preferred fallback)
- `src/amplifyconfiguration.json`

### Notes

- **Global setup/teardown**: when running integration tests, Jest uses `globalSetup`/`globalTeardown` to create a shared Cognito test user and seed a matching `UserState` row.
- **Timeouts**: integration tests run with a 30s timeout (see `test:amplify:int` script).

## Frontend testing (planned; not implemented yet)

You mentioned you haven’t tested the FE yet — that matches the repo state today (no Cypress setup / no FE test scripts yet).

Planned approach:

- **Unit tests (Jest)**: complex UI/business logic that’s easiest to validate in isolation.
- **Component tests (Cypress component)**: a small set of critical components (not everything).
- **E2E tests (Cypress E2E)**: 1–2 critical user journeys (“golden path”).
