# Authentication & Token Management

This document describes how authentication works in this application, the token lifecycle, and safe practices for configuring session and token expiry.

## Overview

The app uses **NextAuth** as the session layer with **AWS Cognito** as the identity provider. Tokens flow as follows:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │ ──── │  NextAuth   │ ──── │   Cognito   │ ──── │   AppSync   │
│  (cookies)  │      │   (BFF)     │      │ (user pool) │      │  (GraphQL)  │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
```

- **Browser** holds an encrypted NextAuth session cookie (HttpOnly, Secure).
- **NextAuth** manages session state and stores Cognito tokens in its JWT.
- **Cognito** issues ID tokens, access tokens, and refresh tokens.
- **AppSync** validates the Cognito ID token on each request.

## Token Types & Lifetimes

| Token | Issuer | Default Expiry | Purpose |
|-------|--------|----------------|---------|
| NextAuth Session (JWT) | NextAuth | 30 days | Browser session, holds embedded Cognito tokens |
| Cognito ID Token | Cognito | 1 hour | User identity claims, used to authenticate with AppSync |
| Cognito Access Token | Cognito | 1 hour | API authorization (not currently used) |
| Cognito Refresh Token | Cognito | 30 days | Obtain new ID/Access tokens without re-login |

## Token Refresh Flow

The Cognito ID token expires after ~1 hour, but users stay logged in for up to 30 days thanks to automatic token refresh:

1. **On login**: Both ID token and refresh token are stored in the NextAuth JWT.
2. **On each authenticated request**: The `jwt` callback checks if the ID token is expiring (within 60 seconds).
3. **If expiring**: Calls Cognito's `REFRESH_TOKEN_AUTH` flow to get a fresh ID token.
4. **If refresh fails**: Sets `session.error = 'RefreshTokenError'` so the client can redirect to login.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         NextAuth JWT Callback                            │
├──────────────────────────────────────────────────────────────────────────┤
│  1. Is cognitoTokenExpiry within 60s of now?                             │
│     ├─ NO  → Return token as-is                                          │
│     └─ YES → Call Cognito REFRESH_TOKEN_AUTH                             │
│              ├─ Success → Update cognitoIdToken + cognitoTokenExpiry     │
│              └─ Failure → Set error flag, user must re-login             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Stored Token Fields

The NextAuth JWT contains these custom fields (see `src/types/next-auth.d.ts`):

| Field | Type | Description |
|-------|------|-------------|
| `userId` | `string` | Cognito `sub` claim |
| `cognitoIdToken` | `string` | Current Cognito ID token (JWT) |
| `cognitoRefreshToken` | `string` | Cognito refresh token for obtaining new ID tokens |
| `cognitoTokenExpiry` | `number` | Unix timestamp (seconds) when the ID token expires |
| `error` | `'RefreshTokenError'` | Set when token refresh fails |

## SSE Stream Behavior

The price snapshot stream (`/api/price-snapshot/stream`) uses the **Cognito token expiry** (not the NextAuth session expiry) to determine when to close the connection:

- Stream closes 60 seconds before the Cognito ID token expires.
- Client receives an error event: `"Auth token expired, reconnecting..."`.
- Client should reconnect, which triggers a fresh token via the `jwt` callback.

---

## Safe Practices for Token Expiry Configuration

### NextAuth Session Expiry

Configure in `src/lib/auth.ts`:

```typescript
export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days (default)
  },
  // ...
}
```

**Recommendations:**

| Setting | Safe Range | Notes |
|---------|------------|-------|
| `maxAge` | 1 day – 30 days | Shorter = more secure, longer = better UX |
| Absolute minimum | 1 hour | Must exceed Cognito ID token expiry to allow refresh |

**Do NOT** set `maxAge` shorter than Cognito's ID token expiry (1 hour), or users will be logged out before the refresh can occur.

### Cognito Token Expiry

Configure in the **AWS Cognito Console** under:  
`User Pool → App Integration → App clients → [Your Client] → Auth session validity`

| Token | Default | Configurable Range | Recommendation |
|-------|---------|-------------------|----------------|
| ID Token | 1 hour | 5 min – 1 day | Keep at 1 hour (balance security vs refresh frequency) |
| Access Token | 1 hour | 5 min – 1 day | Keep at 1 hour |
| Refresh Token | 30 days | 1 hour – 10 years | 7–30 days for most apps |

**Security considerations:**

- **Shorter ID/Access tokens** = more frequent refreshes, reduced window if token is compromised.
- **Shorter refresh tokens** = users must re-authenticate more often (better for sensitive apps).
- **Longer refresh tokens** = better UX, but higher risk if refresh token is stolen.

### Alignment Rules

To avoid authentication issues, ensure:

1. **NextAuth `maxAge` ≥ Cognito refresh token validity**  
   Otherwise, the NextAuth session expires before the refresh token, and users lose their session unexpectedly.

2. **NextAuth `maxAge` > Cognito ID token validity**  
   Otherwise, sessions expire before the ID token can be refreshed.

3. **Refresh buffer (60s) < ID token validity**  
   The code refreshes 60 seconds before expiry. If ID tokens are < 2 minutes, increase the buffer or increase token validity.

### Example Configurations

**High Security (banking, healthcare):**

```
NextAuth maxAge:        1 day
Cognito ID Token:       15 minutes
Cognito Refresh Token:  1 day
```

**Balanced (typical SaaS):**

```
NextAuth maxAge:        7 days
Cognito ID Token:       1 hour (default)
Cognito Refresh Token:  7 days
```

**High Convenience (low-risk consumer app):**

```
NextAuth maxAge:        30 days
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

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| 401/403 from AppSync after ~1 hour | ID token expired, refresh not working | Ensure `cognitoRefreshToken` is stored and `REFRESH_TOKEN_AUTH` is enabled in Cognito |
| Users logged out unexpectedly | NextAuth `maxAge` < Cognito refresh token validity | Align expiry settings per rules above |
| "Token has expired" in SSE stream | Stream using wrong expiry field | Ensure stream uses `cognitoTokenExpiry`, not `exp` |
| Refresh fails immediately after login | Refresh token not returned by Cognito | Ensure `USER_PASSWORD_AUTH` flow is enabled and returns refresh tokens |

---

## Related Files

- [`src/lib/auth.ts`](src/lib/auth.ts) – NextAuth configuration, token refresh logic
- [`src/types/next-auth.d.ts`](src/types/next-auth.d.ts) – Type augmentations for JWT/Session
- [`src/app/api/price-snapshot/stream/route.ts`](src/app/api/price-snapshot/stream/route.ts) – SSE stream with token expiry handling
- [`src/app/api/auth/[...nextauth]/route.ts`](src/app/api/auth/[...nextauth]/route.ts) – NextAuth route handler
