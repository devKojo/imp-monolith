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

| Route                       | Requirement    | Notes                                                                                                                                                                                                                                                                              |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /register`            | public         | 202, or 409 `EMAIL_TAKEN` when the address already has an account (the unique email index decides; nothing is sent or changed). Same for `POST /register-participant`. Body includes `agreement: { accepted: true, version }` (R-PRV-01); the version is recorded in the audit log |
| `POST /verify-email`        | public         | 204; 400 for invalid, used or expired token                                                                                                                                                                                                                                        |
| `POST /resend-verification` | public         | Always 202 with the same body for unknown, verified and unverified addresses. Limits: 1 per address per minute, 5 per address per hour, 10 per IP per hour (429 with Retry-After). Mail is sent in the background so response time reveals nothing                                 |
| `POST /send-verification`   | session + csrf | Participant asks for a link for their own address. 202 `{status:'sent'}`, or 200 `{status:'already_verified'}`. Limits as for resend                                                                                                                                               |
| `POST /forgot-password`     | public         | Always 202 with the same body for known and unknown addresses. Limits (per address, keyed `pw:`): 1 a minute, 3 an hour; 10 an hour per IP. 429 + Retry-After. The email is sent in the background so timing reveals nothing                                                       |
| `POST /reset-password`      | public (token) | Body `{ token, password }`. 200 `{ accountType }`; 400 `INVALID_TOKEN` for unknown, used or expired; 422 for a weak or breached password (the link is **not** consumed). Failed token guesses count against the IP's login limit                                                   |
| `POST /login`               | public         | Sets `__Host-sid`; returns csrfToken and memberships                                                                                                                                                                                                                               |
| `POST /logout`              | session + csrf | Revokes immediately; clears cookie                                                                                                                                                                                                                                                 |
| `GET /session`              | session        | User, active membership, memberships, csrfToken                                                                                                                                                                                                                                    |
| `POST /switch-tenant`       | session + csrf | Rotates session id and CSRF token; keeps absolute expiry                                                                                                                                                                                                                           |

## Email (Gmail SMTP)

`SmtpMailer` (nodemailer) sends the verification email when `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`
are set; otherwise the dev `ConsoleMailer` prints the token (and refuses to run in production).
For Gmail: host `smtp.gmail.com`, port 465 with `SMTP_SECURE=true` (or 587 with `false`), and an
**App Password** (Google account needs 2-Step Verification), never the account password. Links use
`APP_PUBLIC_URL`. Addresses are never logged.

## Sign-in methods

Email and password only, for both account types. There is no social login, SSO, magic link or
passkey, and nothing in the schema anticipates one.

Participants are not required to verify their email: registration sends no mail and they can sign
in at once (businesses must still verify first). From their account they can ask for a link
(`POST /send-verification`, session + CSRF, same limits as the public resend). Treat an unverified
participant address as unproven: do not send campaign mail to it.

## Password reset

`POST /forgot-password` stores a single-use token (SHA-256 hash only, 1 hour) in `password_resets` and
emails a link to `{APP_PUBLIC_URL}/reset-password?token=...`. `POST /reset-password` checks the token,
vets the password (policy and breach check), then in one transaction: consumes the token, sets the
password, marks the address verified (the link proved ownership), clears any failed-login lock,
**revokes every session** and voids other outstanding reset tokens. A "your password was changed"
email follows. Works for every account type.
Rows are reachable only by the token being redeemed (`app.reset_hash`) or the owning user, like email
verification.

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
