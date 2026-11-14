# Campaigns

What a business runs from a published template: the page text, the prize tiers and the schedule. The entry
form comes from the template (see `modules/templates`). Part of Phase 2 groundwork.

## Responsibilities

- Create, edit, duplicate and delete campaigns for the active business (tenant).
- Keep a campaign editable only while it is a draft; a launched campaign is fixed.
- Decide, on the server, whether a campaign can launch (pre-flight checks) and give it its public address.
- Run the lifecycle: launch, pause, resume, cancel; the schedule moves a campaign to live and completed.
- Detect two people changing the same campaign at once (version check) and refuse the later write.
- Tell the templates module whether a template is in use, so a running campaign keeps its entry form.
- Record every change in the audit trail.

## Data (tenant tables, RLS forced)

| Table             | Notes                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaigns`       | `tenant_id`, optional `template_id` (composite FK `(tenant_id, template_id)`, so only a template of the same business), `title`, `summary`, `slug` (unique across businesses, null until launch), `status`, `start_at`, `end_at`, `version`, `launched_at`, `deleted_at` (soft delete) |
| `campaign_prizes` | Composite FK `(tenant_id, campaign_id)`; `position`, `name`, `value_label` (free text), `winners` (1 to 100000), `description`                                                                                                                                                         |

- Same fail-closed `tenant_isolation` policy as every tenant table. `app_runtime` can `SELECT/INSERT/UPDATE`
  campaigns (no `DELETE`: deletion is `deleted_at`) and also `DELETE` prizes (replaced as a set on save).
- Database checks mirror the application rules: title and summary length, version >= 1, end after start,
  slug format, and "a campaign that is not a draft has a slug and an end time".
- Prize values are text shown as written. The platform does not hold or move money.

## Who can do what

The role comes from the session's active membership, never from the request. A participant account (no active
business) gets `403 NO_ACTIVE_BUSINESS`.

| Action                                          | Roles                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| List and read                                   | owner, administrator, campaign manager, campaign operator, analyst, moderator |
| Pause and resume                                | owner, administrator, campaign manager, campaign operator                     |
| Create, edit, launch, cancel, duplicate, delete | owner, administrator, campaign manager                                        |

## API (`/api/v1/campaigns`, JSON, `Cache-Control: no-store`)

Writes need the session cookie, the `X-CSRF-Token` header and a permitted Origin (same as `/auth`).

| Route                 | Notes                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`               | `{ items: CampaignSummary[] }`, newest first, with the template. Query: `status=` (the effective status), `q=` (title contains)                                                                                               |
| `GET /:id`            | `CampaignDetail` with `prizes` in order; `404` if missing, deleted or another business's                                                                                                                                      |
| `POST /`              | `{ title, templateId? }` -> `201` draft at `version: 1`; `422 CAMPAIGN_INVALID` if the template is not available                                                                                                              |
| `PUT /:id`            | `{ expectedVersion, title, summary, templateId, startAt, endAt, prizes[] }` replaces a draft; `412 VERSION_CONFLICT` if stale; `409 CAMPAIGN_LOCKED` if not a draft; `422 CAMPAIGN_INVALID` if the end is not after the start |
| `POST /:id/launch`    | `{ expectedVersion }`; runs the checks; `422 PREFLIGHT_FAILED` with `error.details.failed`; goes `LIVE`, or `SCHEDULED` if the start is ahead                                                                                 |
| `POST /:id/pause`     | `{ expectedVersion }` from scheduled or live -> `PAUSED`; `409 CAMPAIGN_STATE` otherwise (including one that has ended)                                                                                                       |
| `POST /:id/resume`    | `{ expectedVersion }` from paused -> `LIVE` or `SCHEDULED` by the start time                                                                                                                                                  |
| `POST /:id/cancel`    | `{ expectedVersion }` from scheduled, live or paused -> `CANCELLED` (final)                                                                                                                                                   |
| `POST /:id/duplicate` | `{ title? }` -> `201` new draft (own ids, no schedule, no address), default title "`<title> (copy)`"                                                                                                                          |
| `DELETE /:id`         | Soft delete of a draft -> `204`; `409 CAMPAIGN_LOCKED` otherwise                                                                                                                                                              |

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
2. A published template (not a draft, not deleted).
3. An end time in the future, after the start if there is one.
4. Prizes: at least one for a giveaway or instant-win template (each with a name and one or more winners);
   optional for quizzes and surveys, but any prize that exists must be complete.

The web app shows the same list while editing to guide people; only the server's result decides.

### The public address

`slug` is made at launch from the title plus six random hex characters (`black-friday-3fa91c`), retried if it
is taken, and never changes (R-TEN-07). It is unique across all businesses because the public page is
`/c/{slug}`.

## Templates and campaigns

- A campaign can only use a template of its own business (composite foreign key; the service also checks).
- A template that a running campaign uses (scheduled, live or paused, not yet past its end) cannot be
  unpublished or deleted: the templates module asks this module's `PrismaCampaignUsage` through a port and
  answers `409 TEMPLATE_IN_USE`. Cancel or finish the campaign first.
- If a template is later deleted or made unavailable, a draft campaign shows no template and fails the
  template check until one is chosen.

## Concurrency

Every change bumps `version`. Writes send the version they read, and the repository puts the version and the
allowed statuses in the `UPDATE ... WHERE`, so the check and the write are one atomic step.

## Audit

`campaign.created`, `.updated`, `.launched`, `.paused`, `.resumed`, `.cancelled`, `.duplicated`, `.deleted`,
with the campaign id (and version or source id) as metadata. No titles or prize text (R-PRV-06).

## Not built yet

- **The public campaign page and API** (`/c/{slug}`, `GET /public/campaigns`) and participation (entering,
  one-time codes, draws). Public reads need a cross-business read path decided with the public-api profile;
  entering needs the participation module. The campaign builder previews the page; nothing is published to
  participants yet.
- **Events.** Launch, pause and cancel should emit outbox events (identifiers only, R-EVT-12) once the outbox
  publisher exists.
- **Contracts** are hand-written here and in the web app; replace with the generated client (R-STK-04). The
  launch checks exist in both places until then.
- Time zone is not stored: instants are stored in UTC and shown in the viewer's zone.
- Limits: 10 prize tiers, 600 characters of summary; no per-business campaign quota.
