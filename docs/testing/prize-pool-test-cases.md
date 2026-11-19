# Prize pool campaigns: test cases

Scope: the prize pool feature (commit `72aed53`) and the end-to-end flow around it: business creates a
campaign, launches it, participants join through a quiz or survey, seats run out, the campaign closes.

Sources: `apps/api/src/modules/campaigns` (`domain/pool.ts`, `domain/rules.ts`,
`infrastructure/participant-seats.ts`, `MODULE.md`), the quiz and survey repositories, and the web
`PrizeEditor`, `PublicCampaignView` and `modules/campaigns/pool.ts`.

How to read this: **Priority** is P1 (must pass before release), P2 (should), P3 (nice to have).
**Type** is U (unit), I (API or DB integration), E (browser end-to-end), M (manual or exploratory).
Expected results come from reading the code and `MODULE.md`. Nothing here has been run yet.

## 0. Suspected defects to check first

These came from reading the code. Each one has a matching test case below. Confirm or dismiss them
before trusting the happy paths.

| #   | Suspicion                                                                                                                                                                                                                                                                                                                                              | Test |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| S1  | The quiz and survey slug lookups now accept stored `COMPLETED`, but the `public_read` RLS policy on `campaigns` still allows only `LIVE` or started `SCHEDULED`. If so, a full campaign is invisible to `withPublic`. People already in cannot resume, and a new person gets a 404 instead of `409 CAMPAIGN_FULL`. The `seats.db.test.ts` file does not cover this path. | E-FULL-03, E-FULL-04 |
| S2  | The public page `/c/{slug}` and `/discover` use the same policy, so the "full" message (`pub.pool.full`) may never be reachable. A full campaign may simply 404.                                                                                                                                                                                       | E-FULL-05 |
| S3  | `claimSeat` is called when no existing attempt or response is found, outside any lock. Two simultaneous first requests from the same person can both pass the check, and the second `UPDATE` waits for the first to commit and then counts again. The `upsert` returns one row, but two seats are used.                                                  | C-RACE-03 |
| S4  | `claimSeat` does not check the stored status. A pause or cancel that lands between the lookup and the claim can be overwritten with `COMPLETED` when the last seat is taken.                                                                                                                                                                          | C-RACE-05 |
| S5  | Pools are accepted on any template, but giveaways, polls and instant wins cannot be entered yet. Such a campaign shows "N spots left" and can never fill.                                                                                                                                                                                              | P-TPL-02 |
| S6  | Switching a draft from pool back to tiers: the API stores `prizes: []` while a pool is set, so tiers typed before the pool may be gone after a save and reload.                                                                                                                                                                                      | P-UI-09 |
| S7  | Duplicating a pool campaign copies `settings`. `participant_count` must start at 0 on the copy.                                                                                                                                                                                                                                                       | L-DUP-02 |
| S8  | The last seat bumps `version`. A manager's open page now holds a stale version, so pause, resume and archive return `412 VERSION_CONFLICT`.                                                                                                                                                                                                           | L-VER-01 |

## 1. Pool rules (unit, `domain/pool.ts` and `web/.../pool.ts`)

Both files mirror each other. Run every case against both.

### 1.1 Share arithmetic

| ID      | Pri | Type | Input (amount / seats)             | Expected                                                             |
| ------- | --- | ---- | ---------------------------------- | -------------------------------------------------------------------- |
| P-SH-01 | P1  | U    | 1000 / 10                          | share 100, remainder 0                                               |
| P-SH-02 | P1  | U    | 1000 / 3                           | share 333, remainder 1                                               |
| P-SH-03 | P1  | U    | 10 / 10                            | share 1, remainder 0 (smallest valid share)                          |
| P-SH-04 | P1  | U    | 9 / 10                             | share 0, `poolProblem` is "too small to give every participant a share" |
| P-SH-05 | P2  | U    | 1 / 1                              | share 1, valid                                                       |
| P-SH-06 | P2  | U    | 1_000_000_000_000 / 1_000_000      | share 1_000_000, remainder 0, no precision loss                      |
| P-SH-07 | P2  | U    | 999_999_999_999 / 1_000_000        | share 999_999, remainder 999_999 (remainder stays under one share per seat) |
| P-SH-08 | P2  | U    | web `poolShare` with seats 0       | share 0, remainder equals amount, no divide-by-zero or `NaN`/`Infinity` |
| P-SH-09 | P3  | U    | Invariant, random amounts and seats | `share * seats + remainder === amount` and `0 <= remainder < seats`  |

### 1.2 Validation (`poolProblem`)

| ID      | Pri | Type | Input                                          | Expected                                                         |
| ------- | --- | ---- | ---------------------------------------------- | ---------------------------------------------------------------- |
| P-VAL-01 | P1 | U    | amount 0                                       | "must be more than zero"                                         |
| P-VAL-02 | P1 | U    | amount -5                                      | same                                                             |
| P-VAL-03 | P1 | U    | amount 10.5 (non-integer)                      | same                                                             |
| P-VAL-04 | P1 | U    | amount 1_000_000_000_001                       | "too large"                                                      |
| P-VAL-05 | P1 | U    | amount exactly 1_000_000_000_000               | valid (boundary)                                                 |
| P-VAL-06 | P1 | U    | seats 0, -1, 1.5                               | "Choose how many people can take part"                           |
| P-VAL-07 | P1 | U    | seats 1_000_001                                | same; 1_000_000 is valid                                         |
| P-VAL-08 | P1 | U    | MONEY with currency null                       | "Choose a currency"                                              |
| P-VAL-09 | P1 | U    | MONEY with currency `JPY` (not in the list)    | same                                                             |
| P-VAL-10 | P1 | U    | POINTS with currency `USD`                     | "A points pool has no currency"                                  |
| P-VAL-11 | P2 | U    | `NaN`, `Infinity`, string amount via the API   | rejected by zod (`400`); never reaches the domain                |
| P-VAL-12 | P2 | U    | Check order: amount 0 and seats 0              | reports the amount first (first failing rule wins)               |

### 1.3 Parsing typed amounts (web `parseAmount`)

| ID       | Pri | Type | Input (kind / currency / text) | Expected                                              |
| -------- | --- | ---- | ------------------------------ | ----------------------------------------------------- |
| P-PAR-01 | P1  | U    | MONEY GHS "5000.50"            | 500050                                                |
| P-PAR-02 | P1  | U    | MONEY GHS "5,000.50"           | 500050 (commas removed)                               |
| P-PAR-03 | P1  | U    | MONEY GHS "19.99"              | 1999 (no float drift: `19.99 * 100` is 1998.999...)   |
| P-PAR-04 | P1  | U    | MONEY GHS "1.005"              | null (three decimals rejected, not rounded)           |
| P-PAR-05 | P1  | U    | MONEY UGX "5000.50"            | null (whole-unit currency takes no decimals)          |
| P-PAR-06 | P1  | U    | MONEY UGX "5000"               | 5000                                                  |
| P-PAR-07 | P1  | U    | POINTS "10.5"                  | null                                                  |
| P-PAR-08 | P1  | U    | any "", "  "                   | null                                                  |
| P-PAR-09 | P2  | U    | ".5", "5.", "-5", "+5", "1e3", "0x10", "abc" | null for each                           |
| P-PAR-10 | P2  | U    | "007"                          | 7 (leading zeros tolerated); the field settles on "7" |
| P-PAR-11 | P2  | U    | MONEY GHS "10000000000.00"     | 1_000_000_000_000 (accepted at the limit)             |
| P-PAR-12 | P2  | U    | MONEY GHS "10000000000.01"     | null (over the limit)                                 |
| P-PAR-13 | P2  | U    | POINTS "99999999999999999999"  | null (not a safe integer)                             |
| P-PAR-14 | P3  | U    | Full-width digits, Arabic-Indic digits, non-breaking space | null for digits; trimmed space is fine |

### 1.4 Formatting (`formatPoolAmount` and `formatAmount`)

| ID       | Pri | Type | Input                          | Expected                                                      |
| -------- | --- | ---- | ------------------------------ | ------------------------------------------------------------- |
| P-FMT-01 | P1  | U    | POINTS 10000                   | "10,000 points"                                               |
| P-FMT-02 | P1  | U    | MONEY GHS 500000               | "GH₵ 5,000.00" (symbol per ICU build; check CI Node version)  |
| P-FMT-03 | P1  | U    | MONEY UGX 5000                 | no decimals, "UGX 5,000"                                      |
| P-FMT-04 | P2  | U    | POINTS 1                       | "1 points" today. Decide: acceptable, or pluralise ("1 point")? |
| P-FMT-05 | P2  | U    | Every one of the 16 currencies | no throw; no `NaN`; decimals follow `minorFactor`             |
| P-FMT-06 | P2  | U    | `XOF`, `RWF` (whole-unit)      | `minorFactor` is 1 on both API and web, and both agree        |
| P-FMT-07 | P3  | U    | Share label for a non-evenly-divisible pool (333) | label shows the floor share, never a rounded-up one |
| P-FMT-08 | P3  | M    | Non-English browser locale     | public page still renders "GH₵", digits grouped; no layout break |

### 1.5 Defensive read (`poolOf`)

| ID       | Pri | Type | Stored `settings`                                         | Expected                                    |
| -------- | --- | ---- | --------------------------------------------------------- | ------------------------------------------- |
| P-RD-01  | P1  | U    | `{}`, `null`, `{ pool: null }`, `{ pool: "x" }`           | null                                        |
| P-RD-02  | P1  | U    | `{ pool: { kind: 'GOLD', ... } }`                         | null                                        |
| P-RD-03  | P1  | U    | amount or `maxParticipants` as a string                   | null                                        |
| P-RD-04  | P2  | U    | POINTS with `currency: 'USD'` stored                      | returns `currency: null`                    |
| P-RD-05  | P2  | U    | MONEY with `currency` missing                             | returns `currency: null`; launch blocks it  |
| P-RD-06  | P2  | U    | A pool that fails `poolOf` after a bad manual DB edit     | campaign loads as "no pool"; list and detail do not 500 |

## 2. Saving a draft (API)

`PUT /api/v1/campaigns/:id`, owner, administrator or campaign manager, with CSRF and Origin.

| ID       | Pri | Type | Scenario                                                          | Expected                                                                  |
| -------- | --- | ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P-SV-01  | P1  | I    | Save a valid points pool                                          | `200`; `detail.pool` has `share`, `remainder`, `label`, `shareLabel`      |
| P-SV-02  | P1  | I    | Save a valid money pool                                           | same, with currency                                                       |
| P-SV-03  | P1  | I    | Save an unfinished pool (amount 0, seats 0)                       | `200` (drafts may be incomplete); launch is what refuses it               |
| P-SV-04  | P1  | I    | Send a pool and prize tiers together                              | `200`; tiers dropped, `prizes: []` stored                                 |
| P-SV-05  | P1  | I    | Send `pool: null` after a pool existed                            | pool removed from `settings`                                              |
| P-SV-06  | P1  | I    | Unknown key inside `pool` (`{ extra: 1 }`)                        | `400` (strict schema)                                                     |
| P-SV-07  | P1  | I    | `kind: "GOLD"`, `currency: "JPY"`, negative amount, float amount, seats above 1_000_000 | `400` each                                          |
| P-SV-08  | P1  | I    | Save on a launched campaign                                       | `409 CAMPAIGN_LOCKED`; pool unchanged                                     |
| P-SV-09  | P1  | I    | Stale `expectedVersion`                                           | `412 VERSION_CONFLICT`; pool unchanged                                    |
| P-SV-10  | P1  | I    | Participant account, analyst, moderator or operator saves         | `403` (operators cannot edit)                                             |
| P-SV-11  | P1  | I    | Another business's campaign id                                    | `404`, never `403`, and no pool data leaks                                |
| P-SV-12  | P2  | I    | `settings.pool` omitted entirely (older client)                   | existing pool is **replaced by none**? Check: `settings` is replaced as a set. Decide and document |
| P-SV-13  | P2  | I    | Change template from quiz to survey with a pool set               | pool kept; quiz settings dropped                                          |
| P-SV-14  | P2  | I    | Save with a pool, then read the list (`GET /campaigns`)           | summary shows `maxParticipants` and `participantCount`; `prizeCount` is 0 |
| P-SV-15  | P3  | I    | Audit trail for the save                                          | `campaign.updated` written; no amount or title in metadata (R-PRV-06)     |

## 3. Launch checks (pre-flight)

| ID       | Pri | Type | Scenario                                                          | Expected                                                                      |
| -------- | --- | ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| L-PF-01  | P1  | I    | Pool complete; the other five checks pass                         | launches, `LIVE`, or `SCHEDULED` if start is ahead                            |
| L-PF-02  | P1  | I    | Giveaway or instant-win template (requires prizes) with a pool and no tiers | `prizes` check passes                                              |
| L-PF-03  | P1  | I    | Pool with amount 0, seats 0, MONEY without currency, or share below 1 | `422 PREFLIGHT_FAILED`, `details.failed` contains `prizes`               |
| L-PF-04  | P1  | I    | No pool and no tiers on a prize-required template                 | `prizes` fails (old behaviour unchanged)                                      |
| L-PF-05  | P1  | I    | Pool plus an incomplete tier left in the stored row (legacy data) | pool decides; tier is ignored                                                 |
| L-PF-06  | P2  | U    | Web `preflight` and API `preflight` agree for 20 mixed inputs     | identical pass or fail per check id                                           |
| L-PF-07  | P2  | I    | Web says launchable but the server refuses (clock skew, stale tab) | UI shows the server's failed checks; no crash                               |
| L-PF-08  | P2  | I    | `POINTS` pool with a `currency` sent directly to the API          | currency normalised to null on read; launches. Confirm this is intended       |
| L-PF-09  | P2  | I    | Launch twice (double click)                                       | second returns `409`/`412`; slug generated once, never changes                |

## 4. Joining and seats (API and DB)

`claimSeat` runs on a participant's first quiz attempt or survey response. Use a real database
(`seats.db.test.ts` style). The pool uses `maxParticipants = 3` unless stated.

### 4.1 Counting

| ID        | Pri | Type | Scenario                                                       | Expected                                                              |
| --------- | --- | ---- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| C-SEAT-01 | P1  | I    | First participant starts a quiz                                | `participant_count` 1; status unchanged                               |
| C-SEAT-02 | P1  | I    | Same participant calls start again, or reloads                 | still 1                                                               |
| C-SEAT-03 | P1  | I    | Same participant retakes a quiz (attempt 2 of 3)               | still 1                                                               |
| C-SEAT-04 | P1  | I    | Survey: start, double-click start                              | count 1; one response row                                             |
| C-SEAT-05 | P1  | I    | Third participant joins                                        | count 3, status `COMPLETED`, `version` +1, in the same statement      |
| C-SEAT-06 | P1  | I    | Fourth participant joins                                       | `409 CAMPAIGN_FULL`; no attempt row, no count change, no partial write |
| C-SEAT-07 | P1  | I    | Campaign without a pool                                        | no limit; count still increases; never auto-completes                 |
| C-SEAT-08 | P1  | I    | Pool with `maxParticipants = 1`                                | first join fills and closes it                                        |
| C-SEAT-09 | P1  | I    | Seat claim succeeds but the attempt `upsert` throws            | whole transaction rolls back; count unchanged (the seat is not lost)  |
| C-SEAT-10 | P2  | I    | One person takes both a quiz and a survey in different campaigns | each campaign counts them once                                      |
| C-SEAT-11 | P2  | I    | Soft-deleted campaign (`deleted_at` set)                       | `CAMPAIGN_FULL`/not found; count unchanged                            |
| C-SEAT-12 | P2  | I    | Business account (not a participant) calls start               | `403`/`PARTICIPANT_ONLY`; no seat taken                               |
| C-SEAT-13 | P2  | I    | Unauthenticated, or missing CSRF                               | `401`/`403`; no seat taken                                            |
| C-SEAT-14 | P2  | I    | Participant abandons a started quiz and never submits          | seat stays taken (by design). Document this; consider a timeout       |
| C-SEAT-15 | P3  | I    | `participant_count` and the participants module               | distinct people in `/participants/summary` equals `participant_count` for a pool campaign |

### 4.2 Concurrency

| ID        | Pri | Type | Scenario                                                              | Expected                                                              |
| --------- | --- | ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| C-RACE-01 | P1  | I    | 1 seat left, 10 different people start at the same instant            | exactly one succeeds; nine get `CAMPAIGN_FULL`; count equals max      |
| C-RACE-02 | P1  | I    | 50 people race for 5 seats                                            | exactly 5 attempt rows, `participant_count` 5, status `COMPLETED`, `version` +1 (once) |
| C-RACE-03 | P1  | I    | **S3.** The same person sends two first-start requests simultaneously with 2 seats left | count must be 1 and one seat remains. Expect this to fail today if the suspicion holds |
| C-RACE-04 | P2  | I    | Same person double-clicks retake on a quiz                            | no extra seat; attempt number does not skip                           |
| C-RACE-05 | P2  | I    | **S4.** Pause lands between the slug lookup and the claim of the last seat | stored status must not silently flip from `PAUSED`/`CANCELLED` to `COMPLETED` without a defined rule |
| C-RACE-06 | P2  | I    | Last seat is taken while a manager is launching or pausing           | one of the two wins; the other gets `412`/`409`; no inconsistent state |
| C-RACE-07 | P3  | I    | Database connection drops mid-claim                                   | transaction rolls back; retry is safe and does not double-count       |

## 5. Closing, full and expiry behaviour

| ID        | Pri | Type | Scenario                                                              | Expected                                                              |
| --------- | --- | ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| E-FULL-01 | P1  | I    | Last seat taken                                                       | detail `status` is `COMPLETED` immediately, end date still ahead      |
| E-FULL-02 | P1  | I    | Two seats left, end date passes                                       | status is computed `COMPLETED`; the empty seats' shares are not paid; no seat claim possible |
| E-FULL-03 | P1  | E    | **S1.** A person already holding a seat reloads and resumes their quiz after the campaign filled | the attempt loads and can be submitted. Expect `404` if S1 is true |
| E-FULL-04 | P1  | E    | **S1.** A new person opens the quiz or survey start after it filled   | `409 CAMPAIGN_FULL` and the "full" message (`quiz.error.full`), not a generic not-found |
| E-FULL-05 | P1  | E    | **S2.** A visitor opens `/c/{slug}` after it filled                   | page shows 0 spots and "full" (`pub.pool.full`), not a 404            |
| E-FULL-06 | P1  | E    | Visitor opens `/discover` after it filled                             | the campaign is not offered to join (or is clearly marked full)       |
| E-FULL-07 | P2  | I    | Person with a seat submits their quiz after the campaign is full      | scored normally; result returned                                      |
| E-FULL-08 | P2  | I    | Person with a seat submits after the real end date                    | closed per quiz rules (`ATTEMPT_CLOSED`)                              |
| E-FULL-09 | P2  | I    | Pause a full campaign                                                 | `409 CAMPAIGN_STATE` (not running)                                    |
| E-FULL-10 | P2  | I    | Cancel a full campaign                                                | `409 CAMPAIGN_STATE`. Decide if the business needs a way to cancel it |
| E-FULL-11 | P2  | I    | Archive then unarchive a full campaign                                | status stays `COMPLETED`; count unchanged                             |
| E-FULL-12 | P2  | I    | Republish a full campaign                                             | refused (only `CANCELLED` can be republished)                         |
| E-FULL-13 | P3  | I    | Public detail cache: `s-maxage=30`, `stale-while-revalidate=300`      | stale page may show spots after full; start must still return `CAMPAIGN_FULL` and the UI must show that cleanly |

## 6. Lifecycle interactions

| ID        | Pri | Type | Scenario                                                              | Expected                                                              |
| --------- | --- | ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| L-LIFE-01 | P1  | I    | Pool campaign scheduled, start in the future                          | `SCHEDULED`; public page not yet visible; no seat claim possible      |
| L-LIFE-02 | P1  | I    | Start time arrives                                                    | effective `LIVE` without a background job; seats claimable            |
| L-LIFE-03 | P1  | I    | Pause a live pool campaign with seats taken                           | new participants refused; count unchanged; resume restores           |
| L-LIFE-04 | P1  | I    | Cancel a live pool campaign with seats taken                          | count kept; republish (end still ahead) keeps the same count and the same address |
| L-LIFE-05 | P2  | I    | Resume a paused campaign that has since filled                        | not possible (it is `COMPLETED`)                                      |
| L-VER-01  | P2  | E    | **S8.** Manager's tab is open, the last seat fills, manager clicks Pause | `412 VERSION_CONFLICT`; UI offers reload and shows the new state, no raw error |
| L-DUP-01  | P1  | I    | Duplicate a pool campaign                                             | new draft with the same pool settings, own ids, no schedule, no address |
| L-DUP-02  | P1  | I    | **S7.** Duplicate a campaign that already has participants            | copy has `participant_count` 0                                        |
| L-DEL-01  | P2  | I    | Delete a draft pool campaign                                          | `204`; soft deleted; pool data not exposed anywhere                   |
| L-DEL-02  | P2  | I    | Delete a launched pool campaign                                       | `409 CAMPAIGN_LOCKED`                                                 |

## 7. Templates

| ID        | Pri | Type | Scenario                                                              | Expected                                                              |
| --------- | --- | ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P-TPL-01  | P1  | E    | Pool on a quiz template, full flow                                    | works end to end (see section 9)                                      |
| P-TPL-01b | P1  | E    | Pool on a survey template, full flow                                  | works end to end                                                      |
| P-TPL-02  | P1  | E    | **S5.** Pool on giveaway, poll or instant-win template                | either blocked at save or launch, or clearly noted as not enterable; must not show "N spots left" for something nobody can join |
| P-TPL-03  | P2  | E    | Switch template quiz to survey in the editor with a pool set          | pool kept (see `chooseTemplate`); quiz time limit and pass mark dropped |
| P-TPL-04  | P2  | E    | Switch template to none                                               | pool kept in the draft; launch still blocked by `template` check      |

## 8. Business editor (browser)

`PrizeEditor.vue` and `pages/app/campaigns/[id].vue`.

| ID       | Pri | Type | Scenario                                                          | Expected                                                                   |
| -------- | --- | ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P-UI-01  | P1  | E    | Switch Prizes mode from Tiers to Pool                             | pool form appears, empty; tier list and "Add prize" hidden                 |
| P-UI-02  | P1  | E    | Enter 5000 points and 10 people                                   | shows "each participant receives 500 points"; no remainder line           |
| P-UI-03  | P1  | E    | Enter 1000 and 3                                                  | shows 333 each plus a remainder note of 1 not paid out                     |
| P-UI-04  | P1  | E    | Enter amount 5 and 10 people                                      | shows the "too small" hint; no share line; launch checklist shows prizes failing |
| P-UI-05  | P1  | E    | Pool with only one of the two fields filled                       | hint shows the specific problem; with both empty, shows the neutral empty text |
| P-UI-06  | P1  | E    | Change kind from Points to Money                                  | currency select appears (default GHS); typed amount re-read as major units |
| P-UI-07  | P1  | E    | Money GHS "50.25", then switch currency to UGX                    | amount becomes invalid (0) because UGX takes no decimals; text retained; hint shown; no crash |
| P-UI-08  | P1  | E    | Money, then switch back to Points                                 | currency cleared to null; amount re-parsed (decimals now invalid)          |
| P-UI-09  | P1  | E    | **S6.** Add two tiers, switch to Pool, save, switch back to Tiers, save, reload | document what happens to the tiers. Silent loss of typed prizes is a defect unless confirmed intended |
| P-UI-10  | P1  | E    | Save, reload the page                                             | amount and seats restored in the same typed format ("5000.5" for 500050)   |
| P-UI-11  | P1  | E    | Participants field: "0", "-1", "2.5", "abc", "1000001", empty     | pool seats stored as 0 (invalid); hint shown; no exception               |
| P-UI-12  | P2  | E    | Participants field: "1e2"                                         | accepted as 100 by `Number()`; confirm the field settles to "100" or rejects |
| P-UI-13  | P2  | E    | Paste "5,000.50" and "  5000  " into the amount                   | accepted; leading and trailing spaces ignored                              |
| P-UI-14  | P2  | E    | Launched campaign opened in the editor                            | pool fields read-only; mode switch hidden; "N of M joined" shown          |
| P-UI-15  | P2  | E    | Draft campaign                                                    | joined line hidden (`joined` is null)                                      |
| P-UI-16  | P2  | E    | Page preview with a valid pool                                    | shows the total and "each" share; with an invalid pool shows no prize section (not tiers either) |
| P-UI-17  | P2  | E    | Keyboard only: reach mode switch, kind, currency, amount, seats   | all reachable, labelled, with visible focus; hints announced to a screen reader |
| P-UI-18  | P2  | E    | RTL or very long currency labels, 320px viewport                  | no overflow or clipped text (logical CSS properties)                       |
| P-UI-19  | P3  | E    | Unsaved changes then navigate away                                | the existing unsaved-changes guard still triggers for pool edits           |
| P-UI-20  | P3  | E    | Two tabs edit the same draft                                      | second save gets `412`; pool edits are not silently merged or lost        |

## 9. End-to-end flows (browser plus API plus database)

Seed: one business (owner), five participant accounts. Use a short end date unless the case needs a long one.

### 9.1 Happy path baseline

| ID     | Pri | Type | Steps                                                                                                                                                                                              | Expected                                                                                   |
| ------ | --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E2E-01 | P1  | E    | Owner creates a quiz campaign, adds questions and consent, sets a points pool of 3000 for 3 people, schedules an end date, launches. Three participants each take the quiz, then a fourth tries.  | Each of the first three sees "1000 points each" and a falling spots count. The fourth is told it is full. Campaign shows `COMPLETED` with 3 of 3 joined. |
| E2E-02 | P1  | E    | Same for a survey with a money pool (GHS 1,000.00, 4 people)                                                                                                                                       | shares GH₵ 250.00; closes on the fourth submit or start (per when the seat is taken: on start) |

### 9.2 Failure paths and edges

| ID     | Pri | Type | Steps                                                                                                                       | Expected                                                                                  |
| ------ | --- | ---- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E2E-03 | P1  | E    | Launch with an invalid pool (share below 1)                                                                                 | launch button disabled in the UI; the API refuses if called directly                      |
| E2E-04 | P1  | E    | Two participants race for the last seat from two browsers                                                                   | exactly one gets in; the other sees the full message, with their form state not lost where possible |
| E2E-05 | P1  | E    | Participant starts a quiz (seat taken), campaign fills, participant continues and submits                                    | submit works; result shown. Depends on S1                                                  |
| E2E-06 | P1  | E    | Participant takes a seat, never finishes; the campaign reaches its end date                                                  | the empty seats are not paid; the in-progress attempt closes per quiz rules; the business sees 3 of 5 joined, completed |
| E2E-07 | P1  | E    | A visitor who is not signed in opens `/c/{slug}` and clicks to join                                                         | sent to sign in or register and returned to the campaign; no seat is taken before login   |
| E2E-08 | P1  | E    | A participant who is already in opens the campaign again                                                                     | resumes their attempt; seats left does not change                                         |
| E2E-09 | P2  | E    | Owner pauses mid-way, a participant tries to join, owner resumes                                                              | refused while paused; works after resume; count correct                                   |
| E2E-10 | P2  | E    | Owner cancels with 2 of 5 joined, then republishes before the end                                                            | count 2 kept; 3 seats open; the same address works                                        |
| E2E-11 | P2  | E    | Network failure on the start call                                                                                            | participant sees the network message and retries without losing or doubling a seat       |
| E2E-12 | P2  | E    | Browser back button after being told it is full                                                                              | no stuck spinner; page shows full state                                                   |
| E2E-13 | P2  | E    | Business user (owner) tries to join their own campaign                                                                       | refused (participant accounts only); no seat taken                                        |
| E2E-14 | P3  | E    | Two businesses each run a pool campaign                                                                                       | seats, counts and shares never mix; participants of A do not appear in B                 |
| E2E-15 | P3  | M    | Pool of 1 (a single winner takes everything)                                                                                  | copy reads sensibly ("1 spot"), no plural error                                           |

## 10. Public pages and discovery

| ID       | Pri | Type | Scenario                                                          | Expected                                                                   |
| -------- | --- | ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PUB-01   | P1  | I    | `GET /public/campaigns/:slug` for a pool campaign                 | `pool` with `label`, `shareLabel`, `joined`, `spotsLeft`; `prizes` empty   |
| PUB-02   | P1  | I    | `GET /public/campaigns` list item for a pool campaign             | prize `{ label: "Prize pool", value: <total> }`                            |
| PUB-03   | P1  | I    | `spotsLeft` never negative                                        | `max(0, max - joined)` even if `joined` exceeds max (bad data)             |
| PUB-04  | P1  | I    | Public response must not expose                                   | no `participantCount` of people, names, fields or answers; only counts     |
| PUB-05   | P2  | E    | Hero shows total, each-share and "N of M spots left"              | values match the API; the section switches to a single pool tile, not tiers |
| PUB-06   | P2  | E    | `spotsLeft` is 0 on a stale cached page                            | shows "full" copy; the join button is disabled or leads to the full message |
| PUB-07   | P2  | E    | Search `/discover` by a campaign title                            | a pool campaign appears with the pool amount, not an empty prize           |
| PUB-08   | P2  | I    | Pool campaign of a suspended business                             | not visible, same 404                                                      |
| PUB-09   | P3  | M    | Screen reader on the hero prize                                   | label "Prize pool" announced; spots text is not announced twice            |

## 11. Data, migration and security

| ID      | Pri | Type | Scenario                                                          | Expected                                                                   |
| ------- | --- | ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| DB-01   | P1  | I    | Apply `20261117100000_prize_pool` on a database with existing quiz attempts and survey responses | column added `NOT NULL DEFAULT 0`; no lock timeout; existing campaigns keep working |
| DB-02   | P1  | I    | Backfill under RLS                                                | no error; counts may be 0 where rows are hidden (documented best effort)   |
| DB-03   | P1  | I    | `npm run db:check` and the schema versus migration check          | no drift, so the `schema.prisma` change matches the migration              |
| DB-04   | P1  | I    | `claimSeat` with a wrong tenant id                                | no row updated; `CAMPAIGN_FULL` (not another tenant's campaign changed)    |
| DB-05   | P1  | I    | Tenant A participant's seat claim against tenant B's campaign id   | refused; B's count unchanged                                               |
| DB-06   | P1  | I    | Raw SQL review                                                    | `claimSeat` uses tagged-template `$queryRaw` with typed casts; no string interpolation |
| DB-07   | P2  | I    | `settings->'pool'->>'maxParticipants'` is missing or not an integer string | no SQL error that turns into a 500; treated as no limit or full, by a defined rule |
| DB-08   | P2  | I    | `participant_count` can never go negative or exceed max           | add a CHECK or test; currently only the `UPDATE` guards it                 |
| DB-09   | P2  | I    | A request replay (same CSRF token, same body)                     | idempotent for an existing seat; no extra count                            |
| DB-10   | P3  | I    | Roll forward and back (add column then drop)                      | reversible in a staging copy                                               |
| SEC-01  | P1  | I    | Mass assignment: send `participantCount` or `status` in `PUT`     | `400` (unknown keys rejected); cannot raise or lower seats                 |
| SEC-02  | P1  | I    | Participant forges `campaignId` or `tenantId` in a start request  | ignored; tenant comes from the campaign found by slug, never the request   |
| SEC-03  | P2  | I    | Rate: 1000 start requests from one account                        | no seat inflation (one per person); note rate limiting is "not built yet"  |
| SEC-04  | P2  | I    | Many throwaway participant accounts fill a competitor's pool       | note as an abuse risk (no verification beyond the account); decide mitigation |

## 12. Regression: existing behaviour that this change touched

| ID      | Pri | Type | Scenario                                                          | Expected                                                                   |
| ------- | --- | ---- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| REG-01  | P1  | I    | Campaign with prize tiers and no pool: save, launch, public page  | exactly as before; `pool` is null; `participant_count` counts but never closes |
| REG-02  | P1  | I    | Quiz retakes (`maxAttempts` 3) on a no-pool campaign              | attempt numbers 1, 2, 3; `NO_ATTEMPTS_LEFT` after                           |
| REG-03  | P1  | I    | `settingsOf` for a quiz campaign with no pool                     | quiz settings unchanged; no `pool` key appears                              |
| REG-04  | P1  | I    | A quiz campaign that was stored `COMPLETED` for any other reason before this change | check no such rows exist (the schedule's completion is computed, never stored). If any exist, they are now treated as joinable-by-lookup |
| REG-05  | P2  | E    | Campaign list: search, status filter, archived filter             | unchanged; the new summary fields do not break the table                   |
| REG-06  | P2  | U    | `toUpdateBody`: with and without a pool                           | pool sent as given; `prizes: []` only when a pool is set; `pool: null` when none |

## 13. Suggested automation order

1. Close the gaps that decide S1 to S4, because they are cheap to check and expensive to find in production:
   a DB test that fills a campaign then resumes an existing attempt (S1), a public-page test for a full
   campaign (S2), and a concurrent same-person start (S3).
2. Add the remaining P1 integration cases to `seats.db.test.ts` and `app.campaigns.db.test.ts`.
3. Keep section 1 as table-driven unit tests run against both the API and the web `pool.ts`, so the two
   mirrors cannot drift.
4. Automate E2E-01, E2E-04, E2E-05 and E2E-07 in the browser. Leave the rest as manual or exploratory.

## 14. Execution results (2026-11-17, local dev)

Run against the local app (web on 3001, API on 3000) with a test business and five test participants, all
named "E2E". UI cases were driven in Chrome. Where noted, a case was run through the same browser's
session using `fetch` against the API, because the browser holds one session cookie at a time. One case
(C-RACE-01) was run from a Node script because it needs three signed-in people at once. Everything not
listed below was not executed.

### 14.1 Suspected defects

| #   | Result                 | Evidence                                                                                                                                                                                                                                                        |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Confirmed**          | After the pool filled, a person who already held a seat got `404 NOT_FOUND` on resume (`GET attempt`) and on `submit`, for both a quiz and a survey. The docs say people already in can finish. Likely cause: the `public_read` RLS policy only exposes `LIVE` or started `SCHEDULED`, so the added `COMPLETED` lookup returns nothing. |
| S2  | **Confirmed**          | A full campaign returns `404` from `/public/campaigns/:slug`, drops out of `/public/campaigns`, and `/c/{slug}` shows "This quiz is not available. It may have closed, or it has not started yet." The "full" copy (`pub.pool.full`) and `spotsLeft = 0` can never be shown. |
| S3  | Not reproduced         | P2 sent 2 parallel first-starts with 2 seats left: same attempt id, count went 1 to 2. P3 sent 6 parallel starts with 1 seat left: two returned 200 with one attempt, none returned `CAMPAIGN_FULL`. DB: `participant_count` 3, 3 attempts, 3 people. The other four requests got 404 because the pool had already filled (see S1). |
| S4  | Not run                | Needs a pause landing between the lookup and the claim; hard to hit from a browser.                                                                                                                                                                             |
| S5  | **Confirmed**          | A giveaway with a pool launches `LIVE`. Its page shows "2 of 2 places left" next to "Entering this kind of campaign is not available yet."                                                                                                                      |
| S6  | Confirmed at API level | Saving prize tiers together with a pool succeeds and stores `prizes: []`, so tiers are dropped silently on save. The UI sequence (tiers, pool, save, back to tiers) was not run.                                                                                |
| S7  | Not a defect           | Duplicate of a full campaign: new DRAFT, same pool (3000 / 3), `participantCount` 0, no slug.                                                                                                                                                                   |
| S8  | Mostly moot            | The last seat also completes the campaign, so a later pause returns `409 CAMPAIGN_STATE` (state is checked before the version). A stale resume on a live campaign returns `412 VERSION_CONFLICT`. The UI message for either was not checked.                     |

### 14.2 Case results

| ID                          | Result      | Notes                                                                                                                                  |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P-UI-01, 02, 03, 04         | Pass        | Pool form appears; 3000 / 3 shows 1,000 each; 1000 / 3 shows 333 each and "1 points cannot be split evenly"; 5 / 10 shows "too small". |
| P-UI-07, 08                 | Pass        | GHS 50.25 then UGX keeps the text and shows a hint (amount 0); back to Points clears the currency.                                     |
| P-UI-10                     | Pass        | Saved pool reloads as Points, 3000, 3, "1,000 each".                                                                                   |
| P-UI-11                     | Pass        | Seats 2.5, 1000001 and 0 each show "Enter how many people can take part"; nothing crashes.                                             |
| P-UI-14                     | Pass        | Launched campaign: fields read-only, "3 of 3 places taken", status Completed.                                                          |
| P-UI-16 (partial)           | Pass        | Preview shows "3,000 points / Each participant receives 1,000 points"; the Prizes launch check passes with no tiers.                   |
| P-FMT-04                    | Fail (copy) | "1 points" is shown unpluralised.                                                                                                      |
| P-FMT-02                    | Note        | Money renders as "GHS 10.05" in this browser, not "GH₵". Depends on the ICU build; the test case assumed the symbol.                   |
| P-SV-03 to 09, L-PF-03      | Pass        | Pool plus tiers keeps the pool and drops tiers; `pool: null` clears it; unknown key, bad kind, bad currency, negative, float, seats above 1,000,000 and amount above the cap all `400`; launched campaign `409 CAMPAIGN_LOCKED`; stale version `412`; too-small pool saves as a draft and launch returns `422 PREFLIGHT_FAILED` with `failed: ["prizes"]`. |
| L-PF-01, L-PF-02            | Pass        | Quiz and survey with a pool and no tiers launch `LIVE`.                                                                                |
| L-PF-08                     | Pass (note) | A POINTS pool saved with `currency: "USD"` is stored with `currency: null`, no error.                                                  |
| L-DUP-01, L-DUP-02          | Pass        | See S7.                                                                                                                                |
| E-FULL-01                   | Pass        | Last seat sets `COMPLETED`, count 3, version bumped, end date still ahead.                                                             |
| E-FULL-03                   | **Fail**    | See S1.                                                                                                                                |
| E-FULL-04                   | **Fail**    | A new person gets `404 "Quiz not found"`, not `409 CAMPAIGN_FULL` and not the `quiz.error.full` message.                               |
| E-FULL-05, E-FULL-06        | **Fail**    | See S2.                                                                                                                                |
| E-FULL-09, 10, 12           | Pass        | Pause, cancel, resume and republish on a full campaign all `409 CAMPAIGN_STATE` (cancel being refused is a product question).          |
| E-FULL-11                   | Pass        | Archive then unarchive keeps `COMPLETED`, count 3, `archivedAt` null again; list row shows 3 of 3.                                     |
| L-DEL-02                    | Pass        | Delete on a launched campaign `409 CAMPAIGN_LOCKED`.                                                                                   |
| C-SEAT-01, 02, 04           | Pass        | First start takes a seat; reload and double start take none (quiz and survey).                                                         |
| C-SEAT-05, 06               | Partial     | Third person fills it. The fourth person's refusal is a 404, not a 409 (see E-FULL-04).                                                |
| C-RACE-01                   | Pass        | Node script, 3 people, 1 seat: one `200`, two `409 CAMPAIGN_FULL`. DB: count 1, 1 attempt. This is the only path that returns `CAMPAIGN_FULL`. |
| C-RACE-03                   | Pass        | See S3.                                                                                                                                |
| C-SEAT-12, E2E-13           | Pass        | Business owner starting a quiz gets `403 PARTICIPANT_ONLY`; no seat taken.                                                             |
| E2E-01                      | Partial     | Three people joined and the campaign closed at 3 of 3, but a fourth person got a 404 and P2 (holding a seat) could not finish. P1 passed the quiz in the UI. |
| E2E-02                      | Partial     | Survey with a pool of 2: P1's double start took one seat; P2's start filled it; P1 and P3 then got 404.                                |
| E2E-06                      | Pass (note) | Ended with 4 of 5 seats empty: owner sees `COMPLETED`, count 1 of 5, public 404. The in-progress attempt gets 404 on resume or submit, so its answers are never scored. |
| E2E-07                      | Pass        | Visitor clicks "Sign in to start", signs in, is returned to the campaign; no seat taken before sign-in.                                |
| E2E-08                      | Pass        | Reload mid-quiz resumes the same attempt; count unchanged.                                                                             |
| E2E-09                      | Pass        | Paused: join gets 404, count unchanged; resumed: join works (3 of 5).                                                                  |
| E2E-10                      | Pass        | Cancel with 1 seat taken, count stays 1; republish keeps the same address and count; join works afterwards.                            |
| PUB-01, 02, 04, 05          | Pass        | Public detail has `pool` with `joined` and `spotsLeft`, `prizes: []`; list shows "Prize pool"; no people data; hero shows total, share and "3 of 3 places left". |
| E-FULL-13                   | Pass (note) | Right after a join the public API showed `joined: 0` until read with a cache-buster: up to 30 seconds stale, as designed.              |

Not executed: E2E-03, 04 (two browsers), 11, 12, 14, 15, and the unit cases in section 1.

### 14.3 Other things noticed

- The public pages (`/c/{slug}`) show "Sign in" in the header while signed in as a participant. Not investigated.
- One request failed mid-test and left a stray draft ("E2E Quiz Pool 5 cancel", never launched). The launched campaign of the same name is separate.

### 14.4 Test data left in the local database

Business "E2E Pool Test Co" (owner `e2e-owner@example.test`), participants `e2e-p1` to `e2e-p5@example.test`, and these campaigns, all named "E2E ...": Quiz Pool 3, Dup of full, Giveaway Pool, Survey Pool 2, Quiz Pool 5 cancel (two rows), Quiz Pool 5 expiry, Race 1 seat. Two direct database writes were made to the test rows: `email_verified_at` on the owner, and `end_at` moved into the past on "Quiz Pool 5 expiry".
