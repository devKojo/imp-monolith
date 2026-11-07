# Identity and Access

Authentication and server-side sessions (spec R-IAM-01/02/04, R-TEN-12). Part of Phase 1.

## Responsibilities

- Register a business owner (creates Business, User, owner Membership, email-verification token).
- Email verification (single-use, 24 h token; only the SHA-256 hash is stored).
- Login with Argon2id password verification, throttling and account lock.
- Server-side sessions in PostgreSQL (`__Host-sid`, idle 30 min, absolute 12 h), logout/revoke.
- Session-bound CSRF token plus Origin / Sec-Fetch-Site validation on state-changing requests.
- Active tenant derived only from the session's active membership; switching rotates the session.

## Public interface (`index.ts`)

`createIdentityModule({ db, allowedOrigins, sessionSecret?, mailer? })` returns
`{ basePath, router, auth }`. Types: `AuthContext`, `Role`. Middleware: `requireSession`,
`requireCsrfToken`. Other modules never import from `application/`, `infrastructure/` or `domain/`.

## Owned models

`User`, `Session`, `EmailVerification` (`/// @owner identity`). `Membership` is owned here and is
read by Business Management only through this module's interface.

## Endpoints (`/api/v1/auth`)

| Route                 | Requirement    | Notes                                                                                                                                                           |
| --------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /register`      | public         | Always 202; identical response for existing emails. Body includes `agreement: { accepted: true, version }` (R-PRV-01); the version is recorded in the audit log |
| `POST /verify-email`  | public         | 204; 400 for invalid, used or expired token                                                                                                                     |
| `POST /login`         | public         | Sets `__Host-sid`; returns csrfToken and memberships                                                                                                            |
| `POST /logout`        | session + csrf | Revokes immediately; clears cookie                                                                                                                              |
| `GET /session`        | session        | User, active membership, memberships, csrfToken                                                                                                                 |
| `POST /switch-tenant` | session + csrf | Rotates session id and CSRF token; keeps absolute expiry                                                                                                        |

## Events

None yet. `identity.user_registered.v1` etc. arrive with the outbox publisher (events must carry
identifiers only, R-EVT-12).

## Dependencies

`shared/database` (`withIdentity`, `setIdentityUser`), `shared/uuid`, `argon2`, a `Mailer` port.

## Invariants

- Every id is a UUID; tokens are 256-bit random and stored only as SHA-256 hashes.
- Identity rows are protected by RLS via a transaction-local identity scope
  (`app.user_id`, `app.login_email`, `app.session_hash`, `app.verification_hash`); with no scope
  they return nothing. Unscoped or tenant-scoped queries cannot read sessions or users.
- Failure counter is incremented atomically in SQL; the unique email index arbitrates duplicates;
  email verification is redeemed by a conditional `UPDATE` so only one caller wins.
- Login responses and timing are the same for unknown email, wrong password and locked account.
- Password hashing runs under a semaphore; saturation returns 503 with `Retry-After`.
- Audit rows contain identifiers only (no email, no token).

## Failure behaviour

- Breached-password service unreachable: check fails open (logged), registration continues.
- Rate limiting is in-process per instance until Redis is introduced; the `LoginRateLimiter`
  port is the seam (fail-closed onto this limiter, R-RDS-02).
- Sessions live only in PostgreSQL; a Redis read-through cache is a later optimisation.

## Not yet implemented (follow-ups)

MFA/TOTP and recovery codes, step-up auth, invitations and ownership transfer, password reset and
resend-verification, participant OTP sessions (R-IAM-07), the permission matrix and route
permission metadata (R-IAM-06), suspended/deactivated business handling at login, session
cleanup job, Redis session cache.
