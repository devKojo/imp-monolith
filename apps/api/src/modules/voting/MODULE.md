# voting

Voting in a **poll** (one question, a few answers) and an **image vote** (candidates with a picture each). Both
are the same act: a participant picks one option, once, and may then see how everyone voted. The options are
written on the campaign by the business, as content fields of the `campaigns` module (a poll's `choice`
question, or the `candidate` fields of an image vote); this module only reads them.

## Responsibilities

- A participant's vote: read the options, cast one vote, see the standings when the campaign allows it.
- The public facts of a running poll or vote (no standings): title, question, number of options.
- The business reading the standings of its own campaigns.

Not here: the campaign, its options and its settings (`campaigns`), accounts and sessions (`identity`), prizes
and draws, and per-voter detail (a business sees counts, not who voted for what).

## Data (tenant table, RLS forced)

`votes`: one row per participant per campaign (unique key), pointing at `campaign_fields` (a poll's question or
the chosen candidate) with, for a poll, the `choice_index` of the answer. Composite FKs keep every row inside
one business. The runtime role can insert and read but **never update or delete**: a vote is final.

A candidate's picture is `campaign_fields.image_url`, an `https` link (database check and `isHttpsLink`).
There is no file upload yet.

## Who can do what

- Participant: only a participant account (`PARTICIPANT_ONLY`). Business accounts cannot vote.
- Business: reads standings for its own campaigns with any role that may read campaigns.
- Visitors: the public facts only.

## API

| Route                                              | Who                | Notes                                                     |
| -------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| `GET /api/v1/public/voting/:slug`                  | public, cacheable  | kind, title, question, option count; never the standings  |
| `GET /api/v1/voting/:slug`                         | participant        | options, own vote, standings when allowed                 |
| `POST /api/v1/voting/:slug/vote`                   | participant + csrf | `{ optionIndex }`; a second vote is `ALREADY_VOTED` (409) |
| `GET /api/v1/voting/campaigns/:campaignId/results` | business           | votes and whole-number percentages per option, `no-store` |

## Rules worth knowing

- **Options are numbered from 0** in the order the business wrote them; the client sends that number. A
  campaign cannot be edited once it has voters, so the numbering is stable while it runs.
- **Standings visibility** is a campaign setting, `settings.ballot.showResults`: `after_vote` (default; a
  participant sees them once they have voted) or `live` (any signed-in participant sees them).
- **Percentages add up to 100** (largest remainder), or are all zero before the first vote.
- **Voting takes a seat** on the campaign like any participation (`claimSeat`), so a prize pool limit applies.
  A double click inserts nothing and takes no second seat.
- The campaign closing is the only deadline: after its end the vote is not found.

## Not built yet

- Uploading candidate pictures (links only for now).
- Per-voter detail and exports; showing votes in the business's participant list (`participants` module).
- Rate limiting, and participant verification beyond the signed-in account.
