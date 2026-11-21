# Administration

Platform staff reviewing rewards across businesses (ADR-R001, R6). This is the only module that may use the
platform database role (`app_platform`, BYPASSRLS): it has to read every business at once. Everything else
reaches the database through the tenant role and row-level security.

## Who is staff

`platform_staff` (user id, role, granted, revoked). The runtime role has no grant on it, so only this module can
read it. Rows are added by an operator, never through the app:

```
npm run platform:grant-staff -- person@example.com            # grant
npm run platform:grant-staff -- person@example.com --revoke   # revoke
```

Staff sign in like anyone else; being a business owner gives no access. Every call looks the person up in
`platform_staff` (revocation is immediate) and answers `403` otherwise. Routes are only mounted when
`DATABASE_URL_PLATFORM` is set.

## HTTP (`/api/v1/platform`, never cached)

| Route                       | Notes                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /me`                   | `{ staff: true }` or `403`                                                                 |
| `GET /reviews`              | Awards `PENDING_REVIEW` or `HELD`, riskiest first, with rules and cross-business counts    |
| `GET /reports?status=`      | Scam reports, worst first, with the business's open-report count and scam score            |
| `POST /awards/:id/decision` | `{ decision: release\|reject\|revoke, note?, password }`; csrf; `409 DECISION_NOT_ALLOWED` |
| `POST /reports/:id/resolve` | `{ status: REVIEWED\|DISMISSED, note? }`; csrf; the first resolver wins                    |

- **Decisions** re-ask for the reviewer's password (the same lockout as sign-in), run under a row lock, and write
  an event naming the reviewer (`platform_released`, `platform_rejected`, `platform_revoked`) with the note in its
  metadata. Release moves a pending award to `AVAILABLE` (the 14-day claim clock starts then) or a held one back
  to `CLAIMED`, whatever its score: this is the step a business cannot take at 70 or more. Revoke also covers an
  award that is available or claimed; a paid or ended award cannot be changed.
- **Winners and businesses** see a generic reason (`PLATFORM_REVIEWED`, `PLATFORM_DECISION`), never the reviewer or
  the note.
- **Cross-business evidence** in the queue is counts only: other businesses where the same payout destination was
  used, and where someone joined from the same network.
- **Scam score** (`domain/scam.ts`): the worst reason's severity plus 10 for each further person who reported the
  business, capped at 100, open reports only. It orders the queue; it never acts by itself.
- Destinations are never shown here. Reading the queue is not audited yet.

## Known gaps

- Staff authenticate with a password and a re-entered password for decisions. There is no second factor yet; add
  one before real staff use this.
- Nothing acts on a scam score automatically (no suspending a business's payouts); that is a platform decision.
- Reads of personal data by staff are not written to an audit log.
