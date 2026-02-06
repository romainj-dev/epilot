# Cypress Testing

This directory contains E2E and component tests for the application using Cypress.

## E2E Tests

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Dev Server

```bash
pnpm dev
```

The dev server must be running at `http://localhost:3000` before running tests.

### 3. Run Tests

```bash
pnpm cypress:open        # Interactive
pnpm cypress:e2e         # Headless (CI/CD)
```

## Components Tests

```bash
pnpm cypress:open --component   # Interactive
pnpm cypress:component          # Headless (CI/CD)
```

## Test Structure

```
cypress/
├── e2e/                    # E2E test specs
├── support/
│   ├── commands.ts         # Custom Cypress commands (E2E)
│   ├── e2e.ts              # E2E support file
│   └── component.tsx       # Component test support + mount utility
├── fixtures/               # Test data
└── tsconfig.json           # TypeScript config for Cypress

src/components/
├── features/**/*.cy.tsx    # Component tests (co-located)
└── ui/**/*.cy.tsx          # Component tests (co-located)
```

## Custom Commands

- E2E: The full list of custom commands can be found in cypress/support/e2e
- Componentds: The full list of custom commands can be found in cypress/support/components

## data-testid Convention

Components should use `data-testid` attributes for stable element selection

## Troubleshooting

### Tests Fail with "baseUrl not found"

**Solution**: Make sure the dev server is running:

```bash
pnpm dev
```

### Tests Fail with "TEST_USER_EMAIL is undefined"

**Solution**: Set test credentials via `cypress.env.json`.

### Tests Fail with "Invalid credentials"

**Solution**: Ensure the test user exists in Cognito with email confirmed (create via UI).

### Session Not Persisting

**Solution**: Check that NextAuth cookies are being set correctly. Verify `authjs.session-token` cookie exists.
