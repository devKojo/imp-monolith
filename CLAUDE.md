# Project rules

## Git workflow (mandatory)

- Never commit or push directly to `main`. Always create a branch first
  (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and open a pull request into `main`.
- One focused change per branch/PR. Keep commits small and descriptive.
- Do not add `Co-Authored-By` trailers or "Generated with Claude Code" lines to commits or PR
  descriptions.
- Never force-push or rewrite history on `main`.
- Before opening a PR: `npm run lint`, `npm run typecheck`, `npm test`, and for DB changes
  `npm run db:check -w @imp/api`.

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
