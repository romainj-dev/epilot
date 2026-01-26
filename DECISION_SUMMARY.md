# Decision Summary

## Purpose

This document records architecture and tooling decisions, why they were made, and the investigation inputs that informed them. It is intended to be updated as decisions evolve.

## Quick Summary (current working direction)

- Deployment hosting preference: Amplify.
- API style preference: GraphQL.
- Auth preference: NextAuth + Cognito.

## Investigation Inputs

- Requirements emphasize AWS services, persistent user state, and a Next.js app.
- Need strong type safety and good developer experience.
- Considerations include deployment complexity, operational overhead, and support for modern Next.js features.

---

## Settlement Flows: A (Lambda-only), B (Lambda + Tick Store), C (Large Scale)

| Criteria          | Flow A: Lambda + EventBridge (API pull) | Flow B: Lambda + Tick Store (1s/30s)        | Flow C: Large Scale (stream ingestion + store) |
| ----------------- | --------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Triggering        | One-time EventBridge Scheduler at T+60  | One-time EventBridge Scheduler at T+60      | Scheduler or batch settle at T+60              |
| Price source      | Live API call at execution time         | Stored tick at T+60 from periodic collector | Stored tick at T+60 from real-time ingestion   |
| Precision         | Low–Medium (scheduler + API latency)    | Medium–High (bounded by tick interval)      | High (second-level or tick-level)              |
| Infra complexity  | Low                                     | Medium                                      | High                                           |
| Cost              | Low                                     | Low–Medium                                  | Medium–High                                    |
| Scale suitability | Few users                               | Small–Medium                                | High (thousands/millions)                      |
| Dispute risk      | Higher (timing/API variance)            | Medium (windowed by tick interval)          | Low (deterministic stored data)                |

### Decision: Use Flow A for MVP, migrate to B, then C if needed

- Start with Flow A to minimize setup while validating product demand.
- Add Flow B once accuracy expectations rise; 30s ticks are acceptable for early scale.
- Plan for Flow C when traffic or legal/compliance needs demand exact-second settlement.

### Notes

- Flow A cannot guarantee exact-second settlement; define the rule as “closest API price at execution time.”
- Flow B accuracy depends on tick interval and collector reliability; 1s ticks improve precision.
- Flow C requires a durable ingestion pipeline and single source of truth for prices.

---

## Deployment Options: Vercel vs Amplify

| Criteria                | Vercel                             | Amplify                                    | Notes                                   |
| ----------------------- | ---------------------------------- | ------------------------------------------ | --------------------------------------- |
| Next.js feature support | Strong SSR/ISR/RSC support         | Supported, less seamless                   | App Router maturity differs             |
| Core Web Vitals         | Built-in dashboard                 | Manual setup (CloudWatch RUM or 3rd-party) | Observability setup required on Amplify |
| AWS service wiring      | Manual (API GW/Lambda/DDB/Cognito) | First-class via Amplify                    | Amplify reduces AWS wiring              |
| Auth with Cognito       | Manual integration                 | First-class integration                    | Amplify CLI/console support             |
| Deployment pipeline     | Separate from AWS backend          | Unified (frontend + backend)               | Single AWS workflow on Amplify          |
| DX for Next.js          | Best-in-class                      | Good, more config                          | Vercel optimized for Next.js            |
| Multi-env management    | Vercel + AWS coordination          | Amplify environments                       | Amplify handles envs centrally          |

### Decision: Amplify

- Built-in AWS service wiring is critical due to limited AWS experience.
- Faster deployment and configuration by using a single AWS-native workflow.
- Trade-off accepted: Next.js advanced features (RSC/SSR/SSG) are less seamless but still possible.
- Core Web Vitals are not built-in, but CloudWatch RUM can cover observability needs.

### Conclusion

- Choose Amplify for speed of delivery, simplified AWS integration, and reduced deployment overhead.

---

## API Style Options: tRPC vs OpenAPI vs GraphQL

| Criteria               | tRPC                      | OpenAPI (REST)            | GraphQL                   | Notes                                  |
| ---------------------- | ------------------------- | ------------------------- | ------------------------- | -------------------------------------- |
| End-to-end type safety | Excellent (inferred)      | Strong (schema + codegen) | Strong (schema + codegen) | tRPC best in TS-only apps              |
| DX speed               | Very fast                 | Moderate                  | Moderate                  | tRPC minimal boilerplate               |
| Multi-client support   | Limited (TS-centric)      | Excellent                 | Excellent                 | OpenAPI/GraphQL more language-agnostic |
| Query flexibility      | Low (fixed per procedure) | Low (fixed responses)     | High (client-shaped data) | GraphQL native field selection         |
| Public API readiness   | Lower                     | High                      | High                      | OpenAPI/GraphQL standardize contracts  |
| Infra complexity       | Low                       | Low–Medium                | Medium                    | GraphQL adds resolvers + tooling       |

### Decision: GraphQL

- Public API readiness is a key requirement; tRPC is not ideal for that goal.
- GraphQL enables native field selection, which aligns with flexible client needs.
- Additional boilerplate is acceptable given existing familiarity.

### Conclusion

- Choose GraphQL to support public API goals with strong typing and flexible querying.

---

## Auth Options: Cognito Hosted UI vs Custom UI vs NextAuth + Cognito

| Criteria                  | Hosted UI (Cognito) | Custom UI (Cognito APIs) | NextAuth + Cognito | Notes                                 |
| ------------------------- | ------------------- | ------------------------ | ------------------ | ------------------------------------- |
| UI control                | Low                 | High                     | High               | Hosted UI is constrained              |
| Cognito security features | Full                | Full                     | Full               | Still uses Cognito user pools         |
| BFF session handling      | Low                 | Medium                   | High               | NextAuth aligns with Next.js sessions |
| Setup complexity          | Low                 | Medium                   | Medium–High        | NextAuth adds auth glue               |

### Decision: NextAuth + Cognito

- UI control is critical, so Hosted UI is out.
- Cognito security measures apply to both Custom UI and NextAuth.
- BFF architecture favors NextAuth for native Next.js session management.

### Security essentials (baseline)

- Use OAuth Authorization Code + PKCE.
- Strict redirect/callback allow-list (no wildcards).
- Secure token/session storage (HttpOnly, Secure cookies).
- Validate tokens (issuer, audience, expiry).
- Least-privilege scopes.

### Conclusion

- Choose NextAuth + Cognito for UI control with BFF-friendly session handling while keeping Cognito security foundations.
