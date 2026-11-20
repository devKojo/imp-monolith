# giveaway

Entering a giveaway: a participant enters a running giveaway campaign once and holds a numbered ticket. The
prizes, the schedule and the page text are written on the campaign by the business (`campaigns`); this module
only records who entered.

## Responsibilities

- A participant's entry: enter (or get the ticket already held) and read their own ticket.
- The public facts of a running giveaway: title, closing time, how many have entered.

Not here: the campaign and its prizes (`campaigns`), accounts and sessions (`identity`), **drawing winners**,
and bonus entries or referrals.

## Data (tenant table, RLS forced)

`giveaway_entries`: one row per participant per campaign (unique key) with a `ticket_number` that is also
unique per campaign. Composite FK keeps every row inside one business. The runtime role can insert and read but
never update or delete.

## Who can do what

- Participant: only a participant account (`PARTICIPANT_ONLY`). Business accounts cannot enter.
- Visitors: the public facts only.

## API

| Route                               | Who                | Notes                                      |
| ----------------------------------- | ------------------ | ------------------------------------------ |
| `GET /api/v1/public/giveaway/:slug` | public, cacheable  | title, business, closing time, entry count |
| `GET /api/v1/giveaway/:slug`        | participant        | the participant's own ticket, if any       |
| `POST /api/v1/giveaway/:slug/entry` | participant + csrf | enters; repeating returns the same ticket  |

## Rules worth knowing

- **One entry per person, one ticket.** Tickets are 1, 2, 3... in the order people entered. Entering takes a
  seat on the campaign (`claimSeat`), whose row lock also hands out the number, so concurrent entries never
  share one. A double click or a second tab returns the ticket already held.
- A **prize pool** campaign closes when its seats are full, like every other type; people already in keep
  their ticket.
- The campaign closing is the only deadline: after its end the giveaway is not found.

## Not built yet

- Drawing and announcing winners, and the audit trail the design describes.
- Bonus entries (referrals, connected accounts), and entry requirements beyond the signed-in account.
- Showing entries in the business's participant list (`participants` module).
