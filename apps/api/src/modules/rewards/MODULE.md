# Rewards

Who won a campaign and what each person is owed (ADR-R001, part 2). The business never types winners in:
they come from the score ranking, a prize pool's equal shares, or a sealed, reproducible draw.

Not here yet: claiming an award (R3), the business console (R4), risk scoring, holds and rate limits (R5),
platform review and payouts (R6). Awards are created `AVAILABLE`; R5 puts the risk gate in front of that.

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

| Route                                   | Notes                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `POST /rewards/campaigns/:id/draw/seal` | `409 SEAL_NOT_ALLOWED` once closed or if not a draw; repeatable                      |
| `POST /rewards/campaigns/:id/award`     | `409 CAMPAIGN_NOT_ENDED`, `DRAW_NOT_SEALED`, `ALREADY_AWARDED`, `NO_ENTRANTS`; `201` |
| `GET /rewards/campaigns/:id/awards`     | Awards with names and status                                                         |
| `GET /public/rewards/draws/:drawId`     | Public, cacheable, no personal data                                                  |

Another business's campaign is a `404`; a participant account has no active business (`403`).

## Known gaps

- The campaign editor cannot yet set a prize's kind, amount or placing range (R4), so prizes are still text
  (`ITEM`, no amount) until then. Awards work either way.
- Entrant references are stored in the draw row; very large draws (hundreds of thousands) should move to a
  separate table.
