# Project rules

## Git workflow (mandatory)

- Never commit or push directly to `main`. Always create a branch first
  (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and open a pull request into `main`.
- One focused change per branch/PR. Keep commits small and descriptive.
- Do not add `Co-Authored-By` trailers or "Generated with Claude Code" lines to commits or PR
  descriptions.
- Never force-push or rewrite history on `main`.
- Lint, format, typecheck, tests and `db:check` run in GitHub Actions (`.github/workflows/ci.yml`),
  not in a pre-commit hook and not by default on the developer machine, so development and
  browser testing stay fast. Do not run the full suite locally after every change; run a single
  targeted test or `eslint <files>` only when it helps you finish the task.
- Boy Scout rule: when CI reports lint, format or test failures in code related to the feature you
  are working on, fix them in the same branch before starting new work. Do not leave them to pile
  up. Failures in unrelated code get their own `chore/` branch, never a drive-by in a feature PR.

## Engineering baseline

The binding specification is _Interactive Marketing Platform Specification v2.0_; the working
plan is `docs/execution-plan.md`. Key rules for code in this repo:

- Every `id` and id-reference column is a UUID (`uuid(7)` defaults); only `outbox_events.seq` is
  a non-UUID ordering sequence.
- Tenant tables are accessed only through `withTenant` (RLS enforced); never use `platformDb` or
  `systemDb` outside the allowed modules.
- Raw SQL only via tagged-template `$queryRaw` / `$executeRaw`; unsafe variants are banned.
- Schema changes ship as reviewed migrations; roles are provisioned by `db:provision-roles`,
  never in SQL with passwords. Secrets live in `.env` (gitignored), never in the repo.

## Frontend rules (mandatory when touching apps/web or packages/ui)

Active decisions and practices are in `docs/frontend/README.md` (ADR-F001 to ADR-F011 in
`docs/frontend/adr/`). Cite the decision you apply in PR descriptions.

- Reuse first: search the gallery (`/ui/components`) or `docs/frontend/component-catalogue.md`
  before writing UI. Compose existing components, then extend one, and only then add a new one
  (a new component needs a registry entry and a gallery demo block, enforced by tests).
- Reusable UI lives in `packages/ui` (`@imp/ui`), never in `apps/web`. Features use `Ui*`
  components, not raw `<button>`/`<input>`.
- Semantic tokens only (`var(--ui-*)`), logical CSS properties, no hard-coded colours/sizes,
  no `v-html`. Run `npm run check -w @imp/ui` and `npm test -w @imp/ui` before opening a PR.
- Strings come from the catalogue (`i18n/en.ts`) or props; every state in spec section 11 uses
  `UiSystemState`; status uses `UiStatusChip` vocabularies.
- No module-level mutable state in SSR code; no storing participant form state in browser storage.
