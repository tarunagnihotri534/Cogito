# ADR 0003 - Authentication and Session Management

Status: Approved on 2023-06-10 by SecTeam
Date: 2023-06-10

Hey team, here is the decision regarding user tokens.

We agreed that all JWT authentication must go through `src/auth/**/*.ts` and be verified by `src/middleware/auth.ts`.
Do not store credentials in local storage or unencrypted cookies.

Rationale:
Stateless tokens reduce database lookups during API calls while maintaining PCI compliance boundaries.
