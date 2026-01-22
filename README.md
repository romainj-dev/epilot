# BTC One‑Minute Guessing Game

A real‑time web app where players guess whether BTC/USD will be **higher or lower after one minute**. The app shows the latest price, tracks a persistent score, and enforces one active guess at a time. It’s built with a modern AWS‑native stack and designed for a fast, strongly‑typed developer experience.

## Features

- Real‑time BTC/USD price display
- One active guess per player, resolved after **≥ 60s** and a price change
- Persistent score per user (Cognito identity)
- GraphQL API with subscriptions for live updates
- Strongly typed client via GraphQL Codegen

## Tech Stack

- **Next.js (App Router) + TypeScript**
- **AWS Amplify** (hosting + CI/CD)
- **AWS AppSync** (GraphQL API + subscriptions)
- **AWS DynamoDB** (persistent game state)
- **AWS Cognito + NextAuth** (auth, BFF session handling)
- **TanStack Query** (data fetching/cache)
- **Tailwind CSS** (styling)

## Architecture Overview

- **Frontend (Next.js)** talks only to **Next.js server routes** (BFF). The browser never calls AWS services directly.
- **NextAuth** handles Cognito auth and session cookies.
- **AppSync** provides GraphQL queries/mutations/subscriptions.
- **DynamoDB** stores user score + active guess state.
- **Scheduled Lambda (EventBridge)** pulls CoinGecko price and publishes updates to AppSync for subscriptions.

## Prerequisites

- Node.js LTS
- pnpm
- AWS account (free tier)
- AWS CLI configured
- Amplify CLI installed

## Local Setup

> The full step‑by‑step setup is documented in [`SETUP.MD`](./SETUP.MD).

Quick start:

```bash
pnpm install
pnpm dev
```

## Environment Variables

Create `.env.local`:

```
NEXTAUTH_URL=
NEXTAUTH_SECRET=
COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
COGNITO_ISSUER=
APPSYNC_URL=
APPSYNC_REGION=
```

## Development Scripts

```bash
pnpm dev       # start dev server
pnpm lint      # run lint
pnpm format    # run prettier (if configured)
```

## Deployment

Deployment is managed via **AWS Amplify**. See `SETUP.MD` for the full guide. In short:

1. Initialize Amplify (`amplify init`)
2. Add auth/api (`amplify add auth`, `amplify add api`)
3. Push infra (`amplify push`)
4. Connect repo in Amplify Console
5. Deploy

## Project Conventions

- **BFF architecture:** all client calls go through Next.js server routes.
- **Strong typing:** generated GraphQL types are the source of truth.
- **One active guess per user:** enforced in API layer.

## Status

This README reflects the finalized architecture and setup expectations. Implementation details (schema, resolvers, UI, etc.) are built iteratively.
