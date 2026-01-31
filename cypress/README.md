# Cypress E2E Testing

This directory contains end-to-end tests for the application using Cypress.

## Quick Start

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

**Interactive Mode** (recommended for development):
```bash
pnpm cypress:open
```

**Headless Mode** (CI/CD):
```bash
pnpm cypress:run
```

**Headed Mode with Chrome** (debugging):
```bash
pnpm test:e2e:headed
```

## Test Structure

```
cypress/
├── e2e/                    # E2E test specs
├── support/               # Support files and custom commands
│   ├── commands.ts        # Custom Cypress commands
│   └── e2e.ts            # Global hooks and setup
├── fixtures/              # Test data (currently empty)
└── tsconfig.json         # TypeScript config for Cypress
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

**Solution**: Set test credentials via `cypress.env.json` or environment variables.

### Tests Fail with "Invalid credentials"

**Solution**: Ensure the test user exists in Cognito with email confirmed.

### Session Not Persisting

**Solution**: Check that NextAuth cookies are being set correctly. Verify `authjs.session-token` cookie exists.
