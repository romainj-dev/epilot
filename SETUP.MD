# Setup Guide

This guide lists the steps to get the app running locally and deployed on AWS (free tier) using the decided stack: Next.js (App Router) + TypeScript + Amplify + AppSync + DynamoDB + Cognito + NextAuth + TanStack Query + Tailwind + GraphQL Codegen.

## 1) Prerequisites

- **Node.js** (LTS) and **npm** (or pnpm/yarn).
- **Git**.
- **AWS account** (free tier).
- **AWS CLI** (configured with an IAM user that can create AppSync, Cognito, DynamoDB, and Amplify resources).
- **Amplify CLI** (install globally).

Commands:

- `node -v`
- `npm -v`
- `aws --version`
- `amplify --version`

## 2) Clone and install dependencies

- `git clone <your-repo-url>`
- `cd <your-repo>`
- `npm install`

## 3) Create the Next.js app baseline

If the app is not scaffolded yet:

- `npx create-next-app@latest <app-name> --typescript --tailwind --eslint --app`

## 4) Initialize Amplify in the repo

- `amplify init`
  - Choose the existing frontend app and accept defaults for environment.
  - Select **TypeScript** and your preferred editor.

## 5) Add Cognito (Auth)

- `amplify add auth`
  - Choose **Cognito User Pool**.
  - Configure **OAuth (Authorization Code + PKCE)**.
  - Set **callback** and **logout** URLs for local and prod.
  - Keep email verification on.
- `amplify push`

## 6) Add AppSync (GraphQL API)

- `amplify add api`
  - Choose **GraphQL**.
  - Choose **Cognito User Pool** as the auth method.
  - Start with a basic schema (will evolve later).
- `amplify push`

## 7) Add DynamoDB (Data)

If you use AppSync with DynamoDB resolvers, set up DynamoDB as the data source from Amplify or AppSync console.

- Define a **User** entity (score, current guess, timestamps, last price).
- Define a **Guess** entity (direction, createdAt, resolvedAt, priceAtGuess, resolvedPrice).

## 8) Add NextAuth (BFF auth)

- Install NextAuth:
  - `npm install next-auth`
- Configure **Cognito** provider in `app/api/auth/[...nextauth]/route.ts`.
- Ensure:
  - Authorization Code + PKCE
  - Secure HttpOnly cookies
  - Token validation (issuer/audience/exp)

## 9) Add GraphQL Codegen

- Install:
  - `npm install -D @graphql-codegen/cli @graphql-codegen/client-preset`
- Create `codegen.ts` or `codegen.yml` to generate typed hooks from the AppSync schema.
- Run:
  - `npx graphql-codegen`

## 10) Configure TanStack Query

- Install:
  - `npm install @tanstack/react-query`
- Setup `QueryClientProvider` in the root layout.
- Use generated GraphQL hooks for data fetching.

## 11) Implement BTC price updates

- Choose **CoinGecko** for price polling.
- Add a scheduled Lambda (EventBridge) to poll price and publish updates.
- Use **AppSync subscriptions** for real-time updates in the client.

## 12) Environment variables

Create `.env.local` with:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET` (if applicable)
- `COGNITO_ISSUER`
- `APPSYNC_URL`
- `APPSYNC_REGION`

## 13) Run locally

- `npm run dev`
- Visit `http://localhost:3000`

## 14) Deploy with Amplify

- Commit your changes to git.
- Push to the default branch.
- Connect the repo in the **Amplify Console**.
- Configure build settings for Next.js.
- Deploy.

## 15) Verify in production

- Ensure login works via Cognito.
- Verify GraphQL API works and subscriptions update the price.
- Confirm guesses resolve correctly and scores persist.
