# Rewards

Who won a campaign and what each person is owed (ADR-R001, part 2). The business never types winners in:
they come from the score ranking, a prize pool's equal shares, or a sealed, reproducible draw.

Not here yet: risk scoring, holds and shared rate limits (R5), platform review and payouts (R6). Awards are created `AVAILABLE`; R5 puts the risk gate in front of that.

## How winners are chosen

| Selection | Campaign                     | Who is eligible                                      | Result                                                     |
| --------- | ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `RANKING` | quiz (default)               | finished attempts that did not fail; best per person | best score first, then earliest finish, then lower user id |
| `DRAW`    | giveaway, survey, poll, vote | everyone in (quiz and survey: finished)              | seeded shuffle; the first people take the places in order  |
| `POOL`    | any campaign with a pool     | everyone who took a seat                             | the same whole share each (`floor(amount / seats)`)        |

Instant win and "completion" rewards are not settled in one run and are refused (`422 REWARDS_UNSUPPORTED`).
A campaign's prizes must agree on one method. Places come from winner counts in prize order ("1st", "2nd",
"3rd to 5th"), or from an explicit `rank_from`/`rank_to`.

## Reproducible draws

1. **Seal** (while the campaign is open): the server picks a secret nonce and stores
   `rules_hash = H(rules, H(nonce))`. Only the hash is shown. The seal must predate the close.
2. **Draw** (after the close): the entrants become one-way references (`H(drawId:userId)`) in user-id
   order; `seed = H(rules_hash, entrants_hash, nonce)` drives a Fisher-Yates shuffle (HMAC-SHA256 counter
   stream, rejection sampling, no modulo bias). The prizes' places are filled from the front.
3. **Verify**: `GET /public/rewards/draws/:id` returns the rules, nonce, entrant references, seed and winner
   references. Anyone recomputes every hash and the shuffle (`verifyDraw`). Nobody is named. Before the draw
   is made the endpoint answers 404, because the nonce is still secret.

The draw is bound to the prizes: if they no longer hash to the sealed value, settling is refused.

## Claiming (a participant)

`GET /my-rewards` (own awards), `GET /my-rewards/wallet` (points per business), `GET /my-rewards/:id` (with its
history), `POST /my-rewards/:id/claim` (session + csrf). The person is always the session's. Another person's
award is a `404`; a business account is `403 PARTICIPANT_ONLY`.

Layers, in order:

1. **Attempts are limited** per person (15 an hour; in-process until the shared limiter in R5): `429 RATE_LIMITED`.
2. **Points** are claimed with no extra input and credited to the ledger at once (`FULFILLED`), keyed
   `award:<id>` so they can never be credited twice.
3. **Money and items** need a verified email (`403 EMAIL_NOT_VERIFIED`), a valid destination and method
   (`422 CLAIM_INVALID`, with a message to show) and the account password (`403 PASSWORD_CONFIRMATION_FAILED`;
   wrong attempts share the sign-in lockout). They move to `CLAIMED`; the business pays and marks it paid (R4).
4. **The final check is atomic**: one conditional `UPDATE` moves an `AVAILABLE` award inside its window, so two
   racing claims produce one claim (the other returns `alreadyClaimed: true`) and a late claim cannot succeed.
   A late claim writes `EXPIRED` with reason `CLAIM_WINDOW_ENDED`. Held, rejected or withdrawn awards are
   `409 AWARD_NOT_CLAIMABLE`. An unclaimed award past its deadline already reads as `EXPIRED`.

The destination is stored encrypted (AES-256-GCM, key from `REWARD_DATA_KEY`, else `SESSION_SECRET`) with a
keyed fingerprint (to spot one destination used by several accounts, R5) and a masked hint. The API never
returns the destination; only the hint. Each claim also records a `CLAIM` network signal.

| Table           | Notes                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| `reward_claims` | One per award; encrypted destination, fingerprint, hint. Insert-only for the runtime |

Participants read their own awards, events, claim and points through read-only `participant_read` policies.

## Data

| Table           | Notes                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| `reward_awards` | One row per winning place; amount snapshot; `AVAILABLE` with a 14-day `claim_by`            |
| `reward_events` | Insert-only timeline; each award starts with an `awarded` event                             |
| `reward_draws`  | One per campaign; sealed, then completed once (`drawn_at IS NULL` guards the update)        |
| `points_ledger` | Insert-only; `appendPoints` is idempotent per key; `pointsBalance` is the sum, never stored |

Settling is once only: the draw update and the partial unique indexes (slot, person) decide, so two racing
requests cannot both succeed (`409 ALREADY_AWARDED`).

## HTTP (business: session + csrf for writes; roles owner, administrator, campaign manager)

| Route                                      | Notes                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `POST /rewards/campaigns/:id/draw/seal`    | `409 SEAL_NOT_ALLOWED` once closed or if not a draw; repeatable                      |
| `POST /rewards/campaigns/:id/award`        | `409 CAMPAIGN_NOT_ENDED`, `DRAW_NOT_SEALED`, `ALREADY_AWARDED`, `NO_ENTRANTS`; `201` |
| `GET /rewards/campaigns/:id/awards`        | Awards with names and status                                                         |
| `GET /rewards/campaigns/:id/awards/export` | The same as CSV (`text/csv`); destinations masked; spreadsheet formulas neutralised  |
| `GET /rewards/awards/:id/destination`      | The winner's destination, decrypted; writes a `destination_viewed` event             |
| `POST /rewards/awards/:id/fulfil`          | `{ reference }` (3 to 80 chars); `409 AWARD_NOT_PAYABLE`; once, `alreadyPaid` after  |
| `GET /public/rewards/draws/:drawId`        | Public, cacheable, no personal data                                                  |

Another business's campaign is a `404`; a participant account has no active business (`403`).

## Paying out (R4)

The business pays from its own account; the platform records and verifies (ADR-R001 decision 1). A claimed
cash or item award is `CLAIMED`. The business reads the destination (decrypted only in the service, only for
roles that manage rewards) and every read is an insert-only `destination_viewed` event naming the person who
asked, written in the same transaction as the read. It then records its own payment reference: one conditional
`UPDATE ... WHERE status = 'CLAIMED' AND kind <> 'POINTS'` moves the award to `FULFILLED`, so two people paying
at once record one payment. The reference lives in the `fulfilled` event's metadata. The winner sees the award
as fulfilled; the history they read never shows who looked at their details.

A prize's kind, amount, currency and placing are set in the campaign editor and validated when the campaign is
saved (`prizeProblem` in the campaigns module): cash and points need an amount, cash a currency, a placing
range is whole, matches the number of winners and does not overlap another prize.

## Known gaps

- No second approver for large payouts, and no way for a winner to confirm receipt or dispute a payment yet.

- Expiry is applied when a claim is attempted; a scheduled job to expire and notify comes later.
- Entrant references are stored in the draw row; very large draws (hundreds of thousands) should move to a
  separate table.
