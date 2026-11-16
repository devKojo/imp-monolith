# Campaigns

What a business runs from a built-in campaign type (its template): the page text, the prize tiers, the
schedule, the fields (what participants are asked about themselves, and the questions) and the settings (a
quiz's time limit and pass mark). The template only says which kinds of field a campaign of that type may use
(see `modules/templates`); the content itself belongs to the campaign.

## Responsibilities

- Create, edit, duplicate and delete campaigns for the active business (tenant).
- Keep a campaign editable only while it is a draft; a launched campaign is fixed.
- Decide, on the server, whether a campaign can launch (pre-flight checks) and give it its public address.
- Run the lifecycle: launch, pause, resume, cancel; the schedule moves a campaign to live and completed.
- Archive and unarchive: a draft or a finished (completed or cancelled) campaign can be put away and brought
  back exactly as it was. Archiving is a timestamp (`archived_at`), not a status; a running or paused campaign
  must be ended first. An archived campaign is left out of the default list, cannot be edited or launched, and
  is never public.
- Detect two people changing the same campaign at once (version check) and refuse the later write.
- Keep a campaign's fields within what its template allows (kinds and how many), and start a new campaign with
  the fields its type begins with (for example the email field).
- Record every change in the audit trail.

## Data (tenant tables, RLS forced)

| Table             | Notes                                                                                                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns`       | `tenant_id`, optional `template_id` (a built-in type, global), `title`, `summary`, `slug` (unique across businesses, null until launch), `status`, `start_at`, `end_at`, `settings` (JSON, e.g. `{"quiz": {"timeLimitMinutes": 10, "passPercent": 70, "maxAttempts": 1}}`), `version`, `launched_at`, `archived_at`, `deleted_at` |
| `campaign_prizes` | Composite FK `(tenant_id, campaign_id)`; `position`, `name`, `value_label` (free text), `winners` (1 to 100000), `description`                                                                                                                                                                                  |
| `campaign_fields` | Composite FK `(tenant_id, campaign_id)`; `position`, `kind`, `key` (snake_case, unique in the campaign), `label`, `helper`, `required`, `options`, `correct_index` (only a quiz question; checked in the database)                                                                                              |

- Same fail-closed `tenant_isolation` policy as every tenant table. `app_runtime` can `SELECT/INSERT/UPDATE`
  campaigns (no `DELETE`: deletion is `deleted_at`) and also `DELETE` prizes and fields (replaced as a set on save).
- Database checks mirror the application rules: title and summary length, version >= 1, end after start,
  slug format, and "a campaign that is not a draft has a slug and an end time".
- Prize values are text shown as written. The platform does not hold or move money.

## Who can do what

The role comes from the session's active membership, never from the request. A participant account (no active
business) gets `403 NO_ACTIVE_BUSINESS`.

| Action                                                   | Roles                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| List and read                                            | owner, administrator, campaign manager, campaign operator, analyst, moderator |
| Pause and resume                                         | owner, administrator, campaign manager, campaign operator                     |
| Create, edit, launch, cancel, archive, duplicate, delete | owner, administrator, campaign manager                                        |

## API (`/api/v1/campaigns`, JSON, `Cache-Control: no-store`)

Writes need the session cookie, the `X-CSRF-Token` header and a permitted Origin (same as `/auth`).

| Route                 | Notes                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`               | `{ items: CampaignSummary[] }`, newest first, with the template. Query: `status=` (the effective status), `q=` (title contains), `archived=true` (the archived ones; they are left out otherwise)                                                 |
| `GET /:id`            | `CampaignDetail` with `prizes` in order; `404` if missing, deleted or another business's                                                                                                                                                          |
| `POST /`              | `{ title, templateId? }` -> `201` draft at `version: 1`; `422 CAMPAIGN_INVALID` if the template is not available; a new campaign starts with the type's default fields and settings                                                               |
| `PUT /:id`            | `{ expectedVersion, title, summary, templateId, startAt, endAt, prizes[], fields[], settings }` replaces a draft; `412 VERSION_CONFLICT` if stale; `409 CAMPAIGN_LOCKED` if not a draft; `422 CAMPAIGN_INVALID` if the end is not after the start |
| `POST /:id/launch`    | `{ expectedVersion }`; runs the checks; `422 PREFLIGHT_FAILED` with `error.details.failed`; goes `LIVE`, or `SCHEDULED` if the start is ahead                                                                                                     |
| `POST /:id/pause`     | `{ expectedVersion }` from scheduled or live -> `PAUSED`; `409 CAMPAIGN_STATE` otherwise (including one that has ended)                                                                                                                           |
| `POST /:id/resume`    | `{ expectedVersion }` from paused -> `LIVE` or `SCHEDULED` by the start time                                                                                                                                                                      |
| `POST /:id/archive`   | `{ expectedVersion }` for a draft, completed or cancelled campaign -> `archivedAt` set; `409 CAMPAIGN_STATE` if it is running, paused or already archived                                                                                         |
| `POST /:id/unarchive` | `{ expectedVersion }` -> `archivedAt` null, status as it was; `409 CAMPAIGN_STATE` if it is not archived                                                                                                                                          |
| `POST /:id/cancel`    | `{ expectedVersion }` from scheduled, live or paused -> `CANCELLED` (final)                                                                                                                                                                       |
| `POST /:id/duplicate` | `{ title? }` -> `201` new draft (own ids, no schedule, no address), default title "`<title> (copy)`"                                                                                                                                              |
| `DELETE /:id`         | Soft delete of a draft -> `204`; `409 CAMPAIGN_LOCKED` otherwise                                                                                                                                                                                  |

Unknown request keys are rejected (`400`). Ids are validated as UUIDs; dates must be ISO instants with an offset.

## Workflow

```
create -> DRAFT --edit--> DRAFT --launch (checks pass)--> SCHEDULED --start time--> LIVE --end time--> COMPLETED
                                                      \-> LIVE ------------------------------------^
LIVE or SCHEDULED --pause--> PAUSED --resume--> LIVE or SCHEDULED     any of those --cancel--> CANCELLED
DRAFT --delete--> (soft deleted)        any state --duplicate--> new DRAFT
```

### Status follows the schedule, without a scheduler

The stored status is what was last written. On every read the schedule is applied: a scheduled campaign shows
as live from its start, and a scheduled, live or paused campaign shows as completed from its end
(`effectiveStatus`). No background job has to keep it true. The roadmap's DB-backed scheduler (Phase 2) will
persist these moves; until then, `status` filters in the list use the effective status.

### Launch checks (server decides)

1. A title.
2. A campaign type (template).
3. An end time in the future, after the start if there is one.
4. Prizes: at least one if the type requires prizes (giveaway, instant win), and every prize complete.
5. Details: a way to reach the participant (an email or phone field) and a required consent.
6. Content: at least as many questions as the type needs (a quiz or survey needs one), and every field complete
   (a label; a choice or quiz question has two or more different answers; a quiz question has its correct
   answer marked).

The web app shows the same list while editing to guide people; only the server's result decides.

### The public address

`slug` is made at launch from the title plus six random hex characters (`black-friday-3fa91c`), retried if it
is taken, and never changes (R-TEN-07). It is unique across all businesses because the public page is
`/c/{slug}`.

## Templates and fields

- A campaign uses one of the built-in types. They are the same for every business, so any business may use any of
  them; there is no per-business template.
- Saving a draft checks the fields against the type: only allowed kinds, no more of a kind than the type allows
  (for example one email field), at most 60 fields and 50 questions, and at most 6 answers on a quiz question.
  Anything else is `422 CAMPAIGN_INVALID`.
- **A draft may be unfinished.** Saving does not require complete questions; launching does (check 6). Machine
  names (`email`, `quiz_question_2`) are made by the server on every save, and fields get new ids each save.
- Quiz settings are only kept for a quiz; for other types `settings` is stored empty.
- Fields and settings are copied when a campaign is duplicated.

## Concurrency

Every change bumps `version`. Writes send the version they read, and the repository puts the version and the
allowed statuses in the `UPDATE ... WHERE`, so the check and the write are one atomic step.

## Audit

`campaign.created`, `.updated`, `.launched`, `.paused`, `.resumed`, `.cancelled`, `.duplicated`, `.deleted`,
with the campaign id (and version or source id) as metadata. No titles or prize text (R-PRV-06).

## Public listing (`GET /api/v1/public/campaigns`, no session)

Running campaigns of every business, soonest to close first, for the `/discover` page. Query: `q` (max 100),
`type`, `cursor` (opaque keyset). Cacheable (`public, s-maxage=30, stale-while-revalidate=300`), no cookies.

- **How it reads across businesses.** `withPublic` sets the transaction-local `app.public_read = 'on'`, which opens
  read-only `public_read` policies on `campaigns`, `campaign_prizes` and `businesses` (the built-in types are global and readable on their own). They allow only
  running, undeleted campaigns with a slug and a future end, and the rows those campaigns need. Nothing else
  (fields, users, sessions, audit, other statuses) is reachable, and the scope cannot write.
- `GET /api/v1/public/campaigns/:slug` returns one campaign (the same public fields) for its page `/c/{slug}`; anything
  not visible is the same 404.
- **Visible** means LIVE, or SCHEDULED and already started, not deleted, not ended, business not suspended.
- **Deviation:** businesses still PENDING are listed, because sign-up does not yet include an approval step.
  Suspended ones are not.
- Output is public content only. `timeZone` is always `UTC`; an instant win shows as a giveaway; polls and votes
  have no source yet and return nothing; there are no images.

## Not built yet

- **Participation for other kinds of campaign.** Quizzes are covered by the `quiz` module; giveaways, polls,
  surveys and instant wins cannot be entered yet. The page `/c/{slug}` exists, and offers entry for quizzes only.
- **Events.** Launch, pause and cancel should emit outbox events (identifiers only, R-EVT-12) once the outbox
  publisher exists.
- **Contracts** are hand-written here and in the web app; replace with the generated client (R-STK-04). The
  launch checks exist in both places until then.
- Time zone is not stored: instants are stored in UTC and shown in the viewer's zone.
- Limits: 10 prize tiers, 600 characters of summary; no per-business campaign quota.
