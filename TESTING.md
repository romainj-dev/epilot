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
| Area | Optimal Approach | Pragmatic Approach | Tradeoff |
| --- | --- | --- | --- |
| Coverage depth | Broad unit + integration + E2E | Minimal unit + smoke integration + 1–2 E2E | Lower confidence on edge cases |
| Ownership model | FE/BE/DevOps/QA split | Single owner | Simpler coordination, less specialization |
| Backend validation | Multiple integration suites | 1–2 backend smoke flows | Fewer regression signals |
| E2E scope | Multiple critical journeys | Golden path only | Risk of missing secondary flows |
| UI testing | Component + UI state coverage | 2–3 key components | Less UI regression protection |
| Infra confidence | CI gates across environments | Minimal checks before release | Higher reliance on manual verification |
