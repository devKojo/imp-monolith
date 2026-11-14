# templates

The built-in campaign types: quiz, survey, giveaway and instant win. A template is not a form a business
designs. It is a type that says which kinds of field a campaign of that type may use, how many of each, and
what a new campaign starts with. The campaign holds the actual content (questions, answers, prizes, settings).

## Responsibilities

- Hold the four built-in types and what each allows, the same for every business.
- Read-only API for business users, so the campaign builder can offer them.
- Give the campaigns module a lookup of the types (wired at the composition root).

Not here: any content of a campaign, and any editing of the types. They are seeded by a migration now and will
be managed by platform admins later (no admin screen yet).

## Data (global tables, no tenant, no row-level security)

| Table                      | Notes                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaign_templates`       | `slug` (unique), `name`, `archetype` (QUIZ, SURVEY, GIVEAWAY, INSTANT), `description`, `min_content_fields` (questions needed to launch), `requires_prizes`, `position` |
| `campaign_template_fields` | Per template: `kind`, `max_count` (null = no limit), `default_count`, `default_label`, `default_required`                                                               |

`app_runtime` can only `SELECT` them (tested); `app_platform` manages them. The seeded rows have fixed ids so
every environment has the same types.

| Type        | Details a participant can give               | Content (questions)                                 | Needs               |
| ----------- | -------------------------------------------- | --------------------------------------------------- | ------------------- |
| Quiz        | email, phone, name, consent                  | quiz question (single choice with a correct answer) | at least 1 question |
| Survey      | email, phone, name, consent                  | multiple choice, rating, short text, long text      | at least 1 question |
| Giveaway    | email, phone, name, address, wallet, consent | none                                                | prizes              |
| Instant win | email, phone, name, address, wallet, consent | none                                                | prizes              |

## API (`/api/v1/templates`, JSON, `no-store`)

| Route      | Who                                  | Notes                                                    |
| ---------- | ------------------------------------ | -------------------------------------------------------- |
| `GET /`    | session, a role that reads campaigns | `{ items: CampaignTemplate[] }`, with the allowed fields |
| `GET /:id` | same                                 | one template, `404` if unknown                           |

There is no create, update, publish or delete: a business cannot change a type.

## Not built yet

- Platform-admin management of the types (add a type, change what a type allows).
- Per-market or per-business availability of a type.
- Retired tables: `templates` and `template_fields` from the earlier business-authored model are no longer used
  by the application and are left in the database, to be dropped in a follow-up once this has been verified.
