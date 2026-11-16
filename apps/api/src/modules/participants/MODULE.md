# participants

What a business sees about the people who took part in its campaigns: counts, and a list of who took part and
how far they got. Read-only. The facts come from quiz attempts (`quiz`) and survey responses (`survey`); this
module writes nothing and owns no table.

## Responsibilities

- A summary: different people, how many participations started and completed, and the same per campaign.
- A list of participation, newest first, filterable by campaign and by status, paged.
- How one campaign is going (totals, 14 days of activity, quiz outcome), for the participation summary.

Not here: taking a quiz or survey (`quiz`, `survey`), accounts (`identity`), the campaigns themselves
(`campaigns`), per-question results or exports, and draws or prizes.

## What is shown

A participant is shown by **name only**: no email, no phone, no answers. A quiz row also carries the score once
finished. Anything more belongs to a later, explicit decision about what a business may see.

## Data access

Every call is one `withTenant` transaction, so row-level security applies. Reading participant names needs a
second `SELECT` policy on `users` (`tenant_participant_select`): a user is visible to a business when they have a
quiz attempt or survey response in it. The policy is read-only, depends on `app.tenant_id` (set by the server
from the signed-in person's active membership) and its sub-queries run under the forced RLS of
`quiz_attempts` and `survey_responses`, so it can only ever match that business's own participants. The
repository selects only `id` and `name`. Supporting indexes: `(tenant_id, user_id)` on both tables.

## Who can do what

Names are personal data, so this is narrower than reading campaigns: business owner, administrator, campaign
manager and analyst. Operators and moderators are refused (`FORBIDDEN`). The role comes from the session's
active membership, never from the request. Participant accounts and visitors cannot reach it.

## API

| Route                                            | Who                  | Notes                                                                                                                                                          |
| ------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/participants/summary`               | business, role above | `participants`, `started`, `completed`, `campaigns[]`                                                                                                          |
| `GET /api/v1/participants`                       | business, role above | `?campaignId=&status=in_progress\|completed&limit=&offset=` (limit up to 100, default 50); `{ items, total }`                                                  |
| `GET /api/v1/participants/campaigns/:campaignId` | business, role above | one campaign's totals, the last 14 days (UTC) started and completed per day, and for a quiz passed / failed and the overall share answered correctly; no names |

All are `Cache-Control: no-store`.

## Rules worth knowing

- **Distinct people** are counted across quizzes and surveys together, so someone who did both is one
  participant but two participations.
- **Paging** reads each source newest first up to the end of the requested page and merges them, so a page is
  exact; very deep offsets cost more. A database view over both tables is the next step if that matters.
- Another business never sees these participants: the policy and every query are scoped to the active business.

## Not built yet

- Per-participant detail, per-question results, exports, and removing a participant's data on request.
- Giveaway and poll participation (those campaign kinds cannot be entered yet).
