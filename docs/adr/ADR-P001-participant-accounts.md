# ADR-P001: Participant accounts are separate from business accounts

- **Status:** Accepted by the product owner; **Architect and Legal sign-off required before release**
- **Date:** 2026-11-07
- **Amends:** ADR-009 / R-TEN-06 (participants are tenant-scoped and have no accounts)
- **Spec:** R-TEN-06, R-IAM-01, R-PRV-01, R-SEC-04, R-PRV-06

## Context

The product owner's designs show two distinct experiences: a participant dashboard ("My Rewards")
and a business dashboard ("Campaign Operations"). A participant only needs an account to take
part in campaigns; business registration creates a business and leads to the business dashboard.
The previous flow collected participant details and still forced a business to be created.

The architecture specification says participants have no platform accounts and verify per
campaign. This is a deliberate override by the product owner, so it is recorded here.

## Decision

1. `users.account_type` is `BUSINESS` (default) or `PARTICIPANT`.
2. A **participant** registers with name, email, password and agreement acceptance
   (`POST /auth/register-participant`). No business and no membership is created; their sessions
   have no active tenant.
3. A **business** registers as before (`POST /auth/register`): business + owner membership.
4. **Sign-in is portal-gated.** `POST /auth/login` takes `portal: participant | business`
   (default `business`). After the password is proven, an account on the wrong portal gets
   `409 WRONG_PORTAL` and no session. The check happens after credential verification so it never
   reveals whether an address has an account.
5. Participant data about **participations stays tenant-scoped** (R-TEN-06 still applies to
   campaign data). Only the identity is platform-level. Participant identities have no
   `memberships`, so no tenant RLS policy grants them access to any business data.
6. Audit: `auth.participant_registered` with `tenant_id` NULL and the agreement version.

## Consequences

- The participant UI (`/me`) and business UI (`/app`) are separate route trees with separate
  sign-in pages; the server enforces the split, not just the UI.
- A person who is both a participant and a business owner needs two accounts (two emails) until a
  later decision allows linking.
- **Open items for sign-off:** retention and erasure of participant identities (R-PRV), whether the
  same email may hold both account types, per-campaign verification still being required before
  a prize claim, and the privacy notice for platform-level participant accounts.
- No phone number or marketing opt-in is collected (nothing honours them yet).
