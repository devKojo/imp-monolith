# ADR-R001: Rewards, claims and risk controls

Status: proposed. Implements Phase 4 of `docs/execution-plan.md` ("reward units, reproducible draws,
claim verification, fraud scoring, moderation").

## Context

Campaigns describe prizes as text (`campaign_prizes.value_label`) and a pool setting. Nothing decides who
won, records what is owed, lets a winner claim it, or checks for abuse. Participants can sign up without
verifying an email, participation rows keep no network or device facts, and the only rate limiter is an
in-memory one used by authentication.

## Decisions

1. **The platform records and verifies; the business pays.** The platform does not hold or move money
   (unchanged, see `campaigns/MODULE.md`). A cash award is fulfilled by the business, who marks it paid with
   a reference; the participant confirms receipt or disputes it. A payout provider is a later, separate ADR.
2. **Prizes become machine-readable.** `campaign_prizes` gains `kind` (CASH, POINTS, ITEM), `amount_minor`
   and `currency`, `rank_from`/`rank_to` (so "1st" and "2nd to 5th" are expressible) and `selection`
   (RANKING, DRAW, POOL, INSTANT, COMPLETION). Existing rows become ITEM and keep their text.
3. **One award row per winning slot** (`reward_awards`). It snapshots the amount when created and moves
   through `PENDING_REVIEW`, `AVAILABLE`, `CLAIMED`, `FULFILLED`, or the exits `HELD`, `REJECTED`,
   `EXPIRED`, `REVOKED`. Partial unique indexes make a duplicate award for the same slot or the same person
   impossible at the database level.
4. **Every state change appends a `reward_events` row.** Insert-only; it drives the participant timeline,
   the business console and the audit trail.
5. **Points are an append-only ledger** (`points_ledger`). Balances are derived, never stored. An
   idempotency key per award makes a replay a no-op. The app role has no UPDATE or DELETE.
6. **Draws are reproducible.** `reward_draws` stores the sealed rules hash, the entrant snapshot hash, the
   public entropy, the seed and the winners, so anyone can re-run the documented seeded shuffle and get the
   same result. One draw per campaign.
7. **Risk signals are captured at participation time** (`participation_signals`): HMAC of the IP and of the
   user agent, never the raw values, written in the same transaction as the seat. They are tenant-scoped
   now; cross-business detection reads them through the platform role in a later PR. Retention is limited
   (default 90 days) and the participant notice needs legal sign-off (R-PRV).
8. **Risk scoring is rule based and explainable.** Pure, versioned rules return weight and evidence; the
   score and rule versions are stored with each decision. Bands: below 30 allow, 30 to 69 hold for review,
   70 and above hold and flag. Reason codes are shown to participants; thresholds are not.
9. **Rate limiting moves to a shared store** (Postgres-backed counters first; Redis is a separate
   infrastructure decision) so limits hold across instances.

## Consequences

- Signals cannot be captured retroactively, so they ship first (R1).
- A platform-admin role is needed for cross-business review (R6); none exists today.
- Money movement stays out of scope until a payout provider is chosen.

## Delivery

R1 schema and signal capture; R2 award engine, draws and ledger; R3 participant claim flow; R4 business
console; R5 rule engine, holds, rate limiting, scam reporting; R6 platform review and payouts.
