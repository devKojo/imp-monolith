# Templates

Reusable entry-form blueprints for a business's campaigns: what a participant is asked when they enter
(identity fields, questions, consent). Part of Phase 2 groundwork; campaigns will reference a published
template.

## Responsibilities

- Create, edit, duplicate and delete templates for the active business (tenant).
- Keep a template editable only while it is a draft; a published template is read-only until unpublished.
- Decide, on the server, whether a template can be published (pre-flight checks).
- Detect two people changing the same template at once (version check) and refuse the later write.
- Record every change in the audit trail.

## Data (tenant tables, RLS forced)

| Table             | Notes                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `templates`       | `tenant_id`, `name` (1-120), `archetype`, `status` (`DRAFT`/`PUBLISHED`), `version`, `created_by_id`, `published_at`, `deleted_at` (soft delete) |
| `template_fields` | Composite FK `(tenant_id, template_id)`; `position`, `kind`, `key` (snake_case, unique per template), `label`, `helper`, `required`, `options`   |

- Both tables use the same fail-closed `tenant_isolation` policy as every tenant table. `app_runtime`
  can `SELECT/INSERT/UPDATE` templates (no `DELETE`: deletion is `deleted_at`) and also `DELETE` fields
  (the field set is replaced on save).
- Database checks mirror the application rules: name length, key format, non-negative position, version >= 1.
- Fields are replaced as a set, so `position` has no unique constraint (reordering never conflicts).

## Who can do what

The role comes from the session's active membership, never from the request. A participant account (no
active business) gets `403 NO_ACTIVE_BUSINESS`.

| Action                                              | Roles                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| List and read                                       | owner, administrator, campaign manager, campaign operator, analyst, moderator |
| Create, edit, publish, unpublish, duplicate, delete | owner, administrator, campaign manager                                        |

## API (`/api/v1/templates`, JSON, `Cache-Control: no-store`)

Writes need the session cookie, the `X-CSRF-Token` header and a permitted Origin (same as `/auth`).

| Route                 | Notes                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`               | `{ items: TemplateSummary[] }`, newest first. Query: `status=DRAFT\|PUBLISHED`, `q=` (name contains, case-insensitive)                                                                       |
| `GET /:id`            | `TemplateDetail` with `fields` in order; `404` if missing, deleted or another business's                                                                                                     |
| `POST /`              | `{ name, archetype }` -> `201` empty draft at `version: 1`                                                                                                                                   |
| `PUT /:id`            | `{ expectedVersion, name, archetype, fields[] }` replaces the draft; `412 VERSION_CONFLICT` if stale; `409 TEMPLATE_PUBLISHED` if published; `422 TEMPLATE_INVALID` for repeated field names |
| `POST /:id/publish`   | `{ expectedVersion }`; runs the checks; `422 PREFLIGHT_FAILED` with `error.details.failed` listing them                                                                                      |
| `POST /:id/unpublish` | `{ expectedVersion }` -> draft again                                                                                                                                                         |
| `POST /:id/duplicate` | `{ name? }` -> `201` new draft (own ids), default name "`<name> (copy)`"                                                                                                                     |
| `DELETE /:id`         | Soft delete of a draft -> `204`; `409 TEMPLATE_PUBLISHED` if published                                                                                                                       |

Unknown request keys are rejected (`400`). Ids are validated as UUIDs.

## Workflow

```
create -> DRAFT --edit (PUT, version checked)--> DRAFT --publish (checks pass)--> PUBLISHED
                  ^                                                                  |
                  +------------------------ unpublish ------------------------------+
DRAFT --delete--> (soft deleted)        any state --duplicate--> new DRAFT
```

### Pre-flight checks (server decides)

1. At least one field.
2. An email or phone field, so entrants can be verified.
3. A consent field that is required.
4. Every field has a label, and every multiple choice question has at least two answers.

The web app shows the same list while editing to guide people; only the server's result decides.

## Concurrency

Every change bumps `version`. Writes send the version they read, and the repository puts the version
(and the status) in the `UPDATE ... WHERE`, so the check and the write are one atomic step: two people
saving at once cannot both win, and a publish cannot slip in after an edit it did not check.

## Audit

`template.created`, `.updated`, `.published`, `.unpublished`, `.duplicated`, `.deleted`, with the
template id (and version or source id) as metadata. No names or field content (R-PRV-06).

## Design choices to revisit

- **No events yet.** Publishing and unpublishing should emit outbox events (identifiers only, R-EVT-12)
  when the outbox publisher and the campaign module exist; nothing consumes them today.
- **Campaigns use templates.** A template that a running campaign uses (scheduled, live or paused, not past its
  end) cannot be unpublished or deleted: `409 TEMPLATE_IN_USE`. The campaigns module answers through the
  `TemplateUsage` port, wired at the composition root, so this module never reads campaign tables.
- **Contracts.** Request and response types are hand-written here and in the web app; replace with the
  generated client when `packages/contracts` exists (R-STK-04). The pre-flight rules exist in both places
  until then.
- **Limits.** 30 fields per template, 10 answers per question; no per-business template quota yet.
