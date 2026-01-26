# Authentication & Token Management

This document describes how authentication works in this application, the token lifecycle, and safe practices for configuring session and token expiry.

## Overview

The app uses **Auth.js (NextAuth v5)** as the session layer with **AWS Cognito** as the identity provider. Tokens flow as follows:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │ ──── │   Auth.js   │ ──── │   Cognito   │ ──── │   AppSync   │
│  (cookies)  │      │   (BFF)     │      │ (user pool) │      │  (GraphQL)  │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
```

- **Browser** holds an encrypted Auth.js session cookie (HttpOnly, Secure).
- **Auth.js** manages session state and stores Cognito tokens in its JWT.
- **Cognito** issues ID tokens, access tokens, and refresh tokens.
- **AppSync** validates the Cognito ID token on each request.

## NextAuth v5 Architecture

With NextAuth v5, we use the new `auth()` pattern for a cleaner DX:

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { auth, handlers, signIn, signOut } = NextAuth({
  // ... configuration
})
```

### Key Exports

| Export     | Purpose                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `auth()`   | Get session (replaces `getServerSession(authOptions)`) - **triggers jwt callback** |
| `handlers` | Route handlers for `/api/auth/*`                                                   |
| `signIn`   | Server-side sign in                                                                |
| `signOut`  | Server-side sign out                                                               |

### Usage in Server Components & API Routes

```typescript
// Server Component
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth()
  // session.cognitoIdToken available for server-side use
}

// API Route
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  const idToken = session?.cognitoIdToken
  // Use idToken for AppSync requests
}
```

### Why `auth()` Instead of `getToken()`

The `getToken()` function only decodes the JWT cookie - it does **not** trigger the `jwt` callback where token refresh logic lives. Using `auth()` ensures:

1. The `jwt` callback runs on every call
2. Expired Cognito tokens are automatically refreshed
3. Sessions with refresh errors are properly flagged

## Token Types & Lifetimes

| Token                 | Issuer  | Default Expiry | Purpose                                                 |
| --------------------- | ------- | -------------- | ------------------------------------------------------- |
| Auth.js Session (JWT) | Auth.js | 30 days        | Browser session, holds embedded Cognito tokens          |
| Cognito ID Token      | Cognito | 1 hour         | User identity claims, used to authenticate with AppSync |
| Cognito Access Token  | Cognito | 1 hour         | API authorization (not currently used)                  |
| Cognito Refresh Token | Cognito | 30 days        | Obtain new ID/Access tokens without re-login            |

## Token Refresh Flow

The Cognito ID token expires after ~1 hour, but users stay logged in for up to 30 days thanks to automatic token refresh:

1. **On login**: Both ID token and refresh token are stored in the Auth.js JWT.
2. **On each `auth()` call**: The `jwt` callback checks if the ID token is expiring (within 60 seconds).
3. **If expiring**: Calls Cognito's `REFRESH_TOKEN_AUTH` flow to get a fresh ID token.
4. **If refresh fails**: Sets `session.error = 'RefreshTokenError'` so the client can redirect to login.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Auth.js JWT Callback                             │
├──────────────────────────────────────────────────────────────────────────┤
│  1. Is cognitoTokenExpiry within 60s of now?                             │
│     ├─ NO  → Return token as-is                                          │
│     └─ YES → Call Cognito REFRESH_TOKEN_AUTH                             │
│              ├─ Success → Update cognitoIdToken + cognitoTokenExpiry     │
│              └─ Failure → Set error flag, user must re-login             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Session & Token Fields

### Session Object (Server-Side)

The session returned by `auth()` includes these fields (see `src/types/next-auth.d.ts`):

| Field                | Type                  | Description                                           |
| -------------------- | --------------------- | ----------------------------------------------------- |
| `user.id`            | `string`              | Cognito `sub` claim                                   |
| `user.email`         | `string`              | User email                                            |
| `cognitoIdToken`     | `string`              | Current Cognito ID token (JWT) - **server-side only** |
| `cognitoTokenExpiry` | `number`              | Unix timestamp (seconds) when the ID token expires    |
| `error`              | `'RefreshTokenError'` | Set when token refresh fails                          |

### JWT Token (Internal)

| Field                 | Type                  | Description                        |
| --------------------- | --------------------- | ---------------------------------- |
| `userId`              | `string`              | Cognito `sub` claim                |
| `cognitoIdToken`      | `string`              | Current Cognito ID token           |
| `cognitoRefreshToken` | `string`              | Cognito refresh token              |
| `cognitoTokenExpiry`  | `number`              | Unix timestamp for ID token expiry |
| `error`               | `'RefreshTokenError'` | Set when token refresh fails       |

## Public Routes with API Key Fallback

The SSE stream (`/api/price-snapshot/stream`) is a public route that uses API key authentication instead of user tokens:

- Does not require user authentication
- Uses `APPSYNC_API_KEY` environment variable
- Provides real-time price updates to all users

For GraphQL routes that need authenticated access, use `auth()` to get the session and extract `cognitoIdToken`.

---

## Safe Practices for Token Expiry Configuration

### Auth.js Session Expiry

Configure in `src/lib/auth.ts`:

```typescript
export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days (default)
  },
  // ...
})
```

**Recommendations:**

| Setting          | Safe Range      | Notes                                                |
| ---------------- | --------------- | ---------------------------------------------------- |
| `maxAge`         | 1 day – 30 days | Shorter = more secure, longer = better UX            |
| Absolute minimum | 1 hour          | Must exceed Cognito ID token expiry to allow refresh |

**Do NOT** set `maxAge` shorter than Cognito's ID token expiry (1 hour), or users will be logged out before the refresh can occur.

### Cognito Token Expiry

Configure in the **AWS Cognito Console** under:  
`User Pool → App Integration → App clients → [Your Client] → Auth session validity`

| Token         | Default | Configurable Range | Recommendation                                         |
| ------------- | ------- | ------------------ | ------------------------------------------------------ |
| ID Token      | 1 hour  | 5 min – 1 day      | Keep at 1 hour (balance security vs refresh frequency) |
| Access Token  | 1 hour  | 5 min – 1 day      | Keep at 1 hour                                         |
| Refresh Token | 30 days | 1 hour – 10 years  | 7–30 days for most apps                                |

**Security considerations:**

- **Shorter ID/Access tokens** = more frequent refreshes, reduced window if token is compromised.
- **Shorter refresh tokens** = users must re-authenticate more often (better for sensitive apps).
- **Longer refresh tokens** = better UX, but higher risk if refresh token is stolen.

### Alignment Rules

To avoid authentication issues, ensure:

1. **Auth.js `maxAge` ≥ Cognito refresh token validity**  
   Otherwise, the Auth.js session expires before the refresh token, and users lose their session unexpectedly.

2. **Auth.js `maxAge` > Cognito ID token validity**  
   Otherwise, sessions expire before the ID token can be refreshed.

3. **Refresh buffer (60s) < ID token validity**  
   The code refreshes 60 seconds before expiry. If ID tokens are < 2 minutes, increase the buffer or increase token validity.

### Example Configurations

**High Security (banking, healthcare):**

```
Auth.js maxAge:         1 day
Cognito ID Token:       15 minutes
Cognito Refresh Token:  1 day
```

**Balanced (typical SaaS):**

```
Auth.js maxAge:         7 days
Cognito ID Token:       1 hour (default)
Cognito Refresh Token:  7 days
```

**High Convenience (low-risk consumer app):**

```
Auth.js maxAge:         30 days
Cognito ID Token:       1 hour (default)
Cognito Refresh Token:  30 days (default)
```

---

## Handling Refresh Errors on the Client

When token refresh fails, the session includes `error: 'RefreshTokenError'`. Handle this in your app to redirect users to login:

```typescript
// Example: In a React component or layout
import { useSession, signOut } from 'next-auth/react'
import { useEffect } from 'react'

function AuthGuard({ children }) {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      // Force re-login
      signOut({ callbackUrl: '/auth' })
    }
  }, [session?.error])

  return children
}
```

---

## Troubleshooting

| Symptom                               | Likely Cause                                      | Solution                                                               |
| ------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 401/403 from AppSync after ~1 hour    | ID token expired, refresh not working             | Ensure API routes use `auth()` not `getToken()`                        |
| Users logged out unexpectedly         | Auth.js `maxAge` < Cognito refresh token validity | Align expiry settings per rules above                                  |
| Refresh fails immediately after login | Refresh token not returned by Cognito             | Ensure `USER_PASSWORD_AUTH` flow is enabled and returns refresh tokens |

---

## Related Files

- [`src/lib/auth.ts`](src/lib/auth.ts) – Auth.js configuration, exports `auth`, `handlers`, `signIn`, `signOut`
- [`src/types/next-auth.d.ts`](src/types/next-auth.d.ts) – Type augmentations for JWT/Session
- [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/[...nextauth]/route.ts) – Auth.js route handler
- [`src/app/api/graphql/route.ts`](src/app/api/graphql/route.ts) – GraphQL proxy using `auth()` for token
