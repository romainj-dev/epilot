# BTC One-Minute Guessing Game

A real-time web app where players guess whether BTC/USD will be **higher or lower after one minute**. The app shows the latest price via live updates (default cadence is one snapshot per minute), tracks a persistent score, and enforces one active guess at a time.

## Features

- Real-time BTC/USD price display
- One active guess per player, resolved after ≥60s and a price change
- Persistent score per user (Cognito identity)
- GraphQL API with live updates
- Automated price snapshot ingestion

## Tech Stack

| Layer     | Technology                                       |
| --------- | ------------------------------------------------ |
| Frontend  | Next.js (App Router), TypeScript, TanStack Query |
| Styling   | Tailwind CSS, Sass modules                       |
| Auth      | AWS Cognito + NextAuth (Credentials provider)    |
| API       | AWS AppSync (GraphQL)                            |
| Database  | AWS DynamoDB                                     |
| Scheduler | AWS Lambda + Step Functions (Express)            |
| Secrets   | AWS SSM Parameter Store                          |
| Hosting   | AWS Amplify                                      |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js (BFF Layer)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ NextAuth    │  │ API Routes  │  │ Server Components       │  │
│  │ (sessions)  │  │ (GraphQL)   │  │ (SSR)                   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  AWS Cognito    │  │  AWS AppSync    │  │  Step Functions │
│  (User Pool)    │  │  (GraphQL API)  │  │  (Scheduler)    │
└─────────────────┘  └────────┬────────┘  └────────┬────────┘
                              │                    │
                              ▼                    ▼
                     ┌─────────────────┐  ┌─────────────────┐
                     │  DynamoDB       │  │  Lambda         │
                     │  - UserState    │  │  (price job)    │
                     │  - PriceSnapshot│  └────────┬────────┘
                     └─────────────────┘           │
                                                   ▼
                                          ┌─────────────────┐
                                          │  CoinGecko API  │
                                          └─────────────────┘
```

### Key Design Decisions

- **BFF Pattern**: The browser never calls AWS services directly. All requests go through Next.js server routes, which handle auth tokens and API calls.
- **Credentials Provider**: NextAuth uses the Credentials provider to exchange email/password with Cognito, storing sessions server-side.
- **Dual Auth on AppSync**: Cognito auth for user requests, API key auth for Lambda-to-AppSync writes.
- **Express Step Functions**: A looping state machine that invokes the price snapshot Lambda, waits the configured interval, then loops. Controlled via SSM parameters.
- **Live price updates (SSE relay)**: The browser subscribes to `/api/price-snapshot/stream` (SSE). The BFF maintains an AppSync subscription (`onCreatePriceSnapshot`) and broadcasts new snapshots to all connected clients.

## Getting Started

See the **[Developer Setup Guide](./SETUP.MD)** for complete instructions on bootstrapping with your own AWS account.

Quick start (if already configured):

```bash
pnpm install
pnpm dev
```

## Environment Variables

Create `.env.local` with:

| Variable            | Description                           |
| ------------------- | ------------------------------------- |
| `NEXTAUTH_URL`      | `http://localhost:3000` for local dev |
| `AUTH_SECRET`       | Random string for NextAuth sessions   |
| `AWS_REGION`        | Your AWS region (e.g., `eu-north-1`)  |
| `COGNITO_CLIENT_ID` | Cognito User Pool Client ID           |
| `APPSYNC_ENDPOINT`  | AppSync GraphQL endpoint URL          |
| `APPSYNC_API_KEY`   | AppSync API key                       |

## Development

```bash
pnpm dev       # Start dev server
pnpm lint      # Run ESLint
pnpm build     # Production build
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Authenticated routes
│   ├── (marketing)/        # Public routes (landing, auth)
│   └── api/                # API routes (BFF)
├── components/
│   ├── features/           # Feature-specific components
│   ├── layout/             # Header, navigation
│   └── ui/                 # Reusable UI primitives
├── graphql/                # GraphQL schema + generated types
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, auth config
└── providers/              # React context providers

amplify/
└── backend/
    ├── api/epilot/         # AppSync schema + resolvers
    ├── auth/epilotAuth/    # Cognito configuration
    ├── function/           # Lambda functions
    └── custom/             # Step Functions scheduler
```

## Conventions

- **Strong typing**: Generated GraphQL types are the source of truth
- **One active guess**: Enforced at the API layer
- **BFF architecture**: Client → Next.js routes → AWS services
