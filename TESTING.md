# Testing Strategy

This document defines the testing approach for the BTC one‑minute guessing app. It assumes a professional environment with cross‑functional teams (FE, BE, DevOps, QA) and focuses on fast feedback, high confidence, and clear ownership.

## Goals

- Catch regressions early without slowing development.
- Validate business‑critical logic (guess resolution, scoring, auth).
- Reduce production risk through contract and integration coverage.
- Keep E2E coverage minimal but meaningful.

## Testing Pyramid (Target Mix)

- **Unit tests (60–70%)**: fast, deterministic, CI gate.
- **Integration tests (20–30%)**: validate system boundaries.
- **E2E tests (5–10%)**: cover critical user journeys only.

## 1) Unit Tests

**Scope**

- Guess resolution logic (time window, price change, scoring).
- GraphQL resolver logic with mocked data sources.
- Next.js server routes (BFF handlers) with mocked GraphQL client.
- UI components (rendering and state transitions).

**Why**

- Highest ROI and fastest feedback.
- Protects core domain logic from regressions.

**Ownership**

- FE: component and client logic.
- BE: resolver and domain logic.

## 2) Integration Tests

**Scope**

- AppSync GraphQL queries/mutations against a dev or local environment.
- DynamoDB data access (local or test tables).
- Cognito auth flows with test users.
- Scheduled Lambda resolution flow (time‑based logic + updates).

**Why**

- Validates service boundaries and infra contracts.
- Catches issues that unit tests cannot (permissions, schema drift).

**Ownership**

- BE + DevOps (infra validation, service wiring).

## 3) End‑to‑End (E2E) Tests

**Critical flows only**

- User signs in and sees current price.
- User submits a guess.
- After ≥ 60 seconds and a price change, guess resolves and score updates.
- User refreshes/returns and sees persisted score.

**Why**

- Verifies the full system works together.
- Keep minimal to avoid flakiness and high maintenance.

**Ownership**

- QA + FE (user journey coverage).

## 4) Contract & Schema Validation

**Scope**

- GraphQL schema linting and validation in CI.
- GraphQL Codegen validation to prevent breaking client types.
- Optional schema‑driven resolver checks.

**Why**

- Prevents silent API breaking changes.
- Ensures strong typing remains reliable.

**Ownership**

- BE (schema) + FE (codegen consumers).

## 5) CI/CD Gates

**Pull Requests**

- Lint + unit tests + codegen validation.

**Main branch**

- Unit + integration tests.

**Pre‑release / staging**

- E2E suite against staging environment.

## 6) Environments & Test Data

- Use **local** and **dev** environments for integration tests.
- Use **staging** for E2E tests.
- Seed test users and test BTC price fixtures where possible.

## 7) Reporting & Quality Bar

- Keep unit tests fast and required for merge.
- Track flakiness in E2E tests and fix or quarantine quickly.
- Fail builds on schema/codegen mismatches.

## Summary

This strategy prioritizes fast, reliable feedback while protecting the most critical paths: auth, price updates, guess resolution, and score persistence. It is structured for collaboration across FE, BE, DevOps, and QA roles.

## Pragmatic Approach

This alternative is designed for a single‑owner workflow with limited time. It keeps coverage focused on the highest‑risk paths while accepting assumptions about lower‑risk areas.

### Unit Tests (minimal)

- Use **Vitest** for core business logic:
  - Guess resolution and scoring.
  - 60‑second rule and pending state handling.

### Backend Integration (minimal but real)

- Smoke test **auth flow** (login → token → call protected resolver).
- Validate **CRUD‑level GraphQL flows** against AppSync/DynamoDB:
  - Create guess.
  - Read current state.
  - Resolve guess / update score.

### E2E (golden path only)

- Use **Cypress E2E**:
  - Sign in → see price → submit guess → score updates after ≥ 60 seconds.

### Component Tests (targeted)

- Use **Cypress Component Testing** for a few critical UI pieces:
  - Guess controls.
  - Score display.
  - Price ticker.

### Mocking

- Use **MSW** to mock GraphQL for component tests to keep UI tests deterministic.

## Optimal vs Pragmatic Comparison

| Area               | Optimal Approach               | Pragmatic Approach                         | Tradeoff                                  |
| ------------------ | ------------------------------ | ------------------------------------------ | ----------------------------------------- |
| Coverage depth     | Broad unit + integration + E2E | Minimal unit + smoke integration + 1–2 E2E | Lower confidence on edge cases            |
| Ownership model    | FE/BE/DevOps/QA split          | Single owner                               | Simpler coordination, less specialization |
| Backend validation | Multiple integration suites    | 1–2 backend smoke flows                    | Fewer regression signals                  |
| E2E scope          | Multiple critical journeys     | Golden path only                           | Risk of missing secondary flows           |
| UI testing         | Component + UI state coverage  | 2–3 key components                         | Less UI regression protection             |
| Infra confidence   | CI gates across environments   | Minimal checks before release              | Higher reliance on manual verification    |

---

## Amplify / AWS Tests (Lambda + Smoke Integration)

This section covers testing for the AWS backend: **Lambdas** (priceSnapshotJob, epilotAuthPostConfirmation) and **real AWS smoke integration tests** that validate wiring across AppSync, Cognito, SSM, and DynamoDB.

### What's Covered

#### 1) Lambda Unit Tests (local, deterministic)

**Location**: `amplify/backend/function/*/src/__tests__/*.unit.test.js`

**Tests**:

- **priceSnapshotJob Lambda**:
  - Missing required env vars → returns `{ enabled: false, intervalSeconds: 30 }`
  - SSM `enabled=false` → returns disabled and does not call CoinGecko/AppSync
  - Happy path (`enabled=true`) → calls CoinGecko + AppSync mutation
  - CoinGecko failure / unexpected response → logs error and returns `{ enabled: true, intervalSeconds }`
  - Missing AppSync API key from SSM → logs error and returns without calling AppSync
  - Missing AppSync endpoint from SSM → returns disabled

- **epilotAuthPostConfirmation Lambda**:
  - Non-confirm trigger (`triggerSource != PostConfirmation_ConfirmSignUp`) → no AppSync call
  - Missing email/sub → no AppSync call
  - Missing SSM env vars → no AppSync call
  - Happy path → calls AppSync `createUserState` with expected input
  - AppSync error → logs error and still returns event

**How to run**:

```bash
pnpm test:amplify:unit
```

**Requirements**:
- No AWS credentials needed (all dependencies are mocked)
- No environment variables needed

#### 2) AWS Integration Smoke Tests (run locally, hit real AWS)

**Location**: `amplify/backend/__tests__/integration/*.int.test.ts`

**Tests**:

1. **PriceSnapshot create + read** (public **API key** auth):
   - Creates a `PriceSnapshot` via `x-api-key` authentication
   - Queries `priceSnapshotsByPk` to verify persistence (same test)
   - Validates all non-nullable fields are returned

2. **Guess create + read** (**Cognito userPools** auth):
   - Creates a temporary Cognito user via admin APIs
   - Obtains an ID token via `USER_PASSWORD_AUTH`
   - Creates a `Guess` via AppSync with Cognito authentication
   - Reads the `Guess` back and validates owner field
   - Cleans up test users after each test

3. **PostConfirmation Lambda → UserState insert**:
   - Invokes the `epilotAuthPostConfirmation` Lambda with a crafted Cognito trigger event
   - Validates that a `UserState` row is created in DynamoDB via AppSync
   - Uses polling to avoid eventual-consistency flakes

**How to run**:

```bash
pnpm test:amplify:int
```

**Requirements**:

These tests call **real AWS services** and require:

1. **A deployed Amplify environment** (typically `dev` or `sandbox`):
   ```bash
   amplify init
   amplify push
   ```

2. **SSM parameters seeded** (per `SETUP.MD`):
   - `/epilot/<env>/appsync-endpoint`
   - `/epilot/<env>/appsync-api-key`
   - `/epilot/<env>/coingecko-api-key` (needed by `priceSnapshotJob`)
   - `/epilot/<env>/price-snapshot-enabled`
   - `/epilot/<env>/price-snapshot-interval-seconds`

3. **Environment variables or Amplify config files**:

   Config is loaded with the following precedence:
   - **Environment variables** (primary source-of-truth)
   - **Amplify-generated config files** (local convenience fallback)

   Environment variables you can set:
   ```bash
   export AWS_REGION=us-east-1
   export APPSYNC_ENDPOINT=https://xxxxx.appsync-api.us-east-1.amazonaws.com/graphql
   export APPSYNC_API_KEY=da2-xxxxx
   export COGNITO_USER_POOL_ID=us-east-1_xxxxx
   export COGNITO_CLIENT_ID=xxxxx
   export LAMBDA_POST_CONFIRMATION_ARN=arn:aws:lambda:us-east-1:xxxxx:function:epilotAuthPostConfirmation-xxxxx
   ```

   If not set, tests will attempt to load from:
   - `src/amplifyconfiguration.json` (generated by Amplify CLI)
   - `amplify/backend/amplify-meta.json` (generated after `amplify push`) — preferred fallback (backend outputs)

4. **AWS credentials with sufficient IAM permissions**:
   - `cognito-idp:AdminCreateUser`
   - `cognito-idp:AdminSetUserPassword`
   - `cognito-idp:AdminDeleteUser`
   - `cognito-idp:AdminGetUser`
   - `cognito-idp:InitiateAuth`
   - `lambda:InvokeFunction`
   - `appsync:GraphQL` (implicit via HTTPS calls with API key or Cognito token)

   Set via `aws configure` or environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=xxxxx
   export AWS_SECRET_ACCESS_KEY=xxxxx
   export AWS_SESSION_TOKEN=xxxxx  # if using temporary credentials
   ```

5. **Cognito User Pool configured for USER_PASSWORD_AUTH**:
   - In Cognito User Pool → App clients → your client → Authentication flows
   - Enable "ALLOW_USER_PASSWORD_AUTH"

### Troubleshooting

**Common failures**:

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `Missing required test config` | Env vars or Amplify config files missing | Run `amplify push` or set env vars |
| `AppSync GraphQL error: Unauthorized` | API key expired or invalid | Re-run `amplify push` to refresh API key |
| `Cognito: InvalidParameterException` | `USER_PASSWORD_AUTH` not enabled | Enable in Cognito User Pool app client settings |
| `AccessDeniedException` | IAM permissions missing | Add required Cognito/Lambda permissions to your AWS profile |
| `Lambda execution failed` | SSM parameters not seeded | Follow `SETUP.MD` to seed SSM parameters |
| `Amplify config files are stale` | Config from a different environment/account | Re-run `amplify pull` or explicitly set env vars |

**Debugging tips**:

- Run with `--verbose` to see detailed request/response logs
- Check Lambda CloudWatch logs for the PostConfirmation function
- Verify SSM parameters exist: `aws ssm get-parameter --name /epilot/<env>/appsync/endpoint`
- Verify Amplify env is pushed: `amplify status`

### Maintenance

- **Keep integration suite small and stable** (**exactly 3 tests**, one per file).
- **Self-cleaning**: all integration tests clean up resources (delete temp Cognito users).
- **Explicit timeouts**: integration tests have 30-second timeout (configured in npm script).
- **No AWS mocking**: integration tests hit real AWS to validate actual wiring.

### Tooling

- **Test runner**: Jest (via `next/jest` for Next.js compatibility)
- **AWS SDK v3**: `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-lambda`
- **Lambda utils**: shared `lambda-utils` package (mapped in `jest.config.js`)

### Philosophy

These tests follow the **pragmatic approach** described earlier:
- **Unit tests**: deterministic, fast, no AWS dependencies
- **Integration tests**: minimal but real, validate service boundaries
- **No Step Functions coverage**: Step Functions wiring is not tested (considered low-risk for this app)
