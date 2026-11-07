# Execution Plan

Aligned with _Interactive Marketing Platform Specification v2.0 (Mandatory Engineering Baseline)_, 6 November 2026.
Requirement IDs (R-XXX-NN) refer to that specification.

## 1. DB connection review (as of 2026-11-07)

`npm run smoke:db` connects to Postgres through the Prisma 7 `PrismaPg` adapter, and the `init` migration is applied (`users` table, 0 rows). The setup is a placeholder and does not yet meet the spec.

**What works**

- Connection through `@prisma/adapter-pg`; `DATABASE_URL` is Zod-validated.
- `.env` and `src/generated` are gitignored.

**Gaps**

| Area               | Current state                                                                                  | Spec requirement                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles and clients  | One `DATABASE_URL` and one `prisma` singleton; connecting role not inspected (likely owner)    | R-TEN-02/03: four roles (`app_migrator`, `app_runtime`, `app_system`, `app_platform`), three clients (`tenantDb`, `systemDb`, `platformDb`), plus `readDb` (R-DAT-13) |
| Tenancy            | No `tenant_id`, no RLS, no `withTenant`                                                        | R-TEN-01/03/05: forced RLS on every tenant table, composite `(tenantId, id)` keys, `withTenant` as the only access path                                               |
| Schema conventions | `uuid()` (v4), `TIMESTAMP(3)`, camelCase columns, no `/// @owner`                              | R-DAT-01: UUIDv7 and `timestamptz`; R-ARC-04: `@owner` on every model                                                                                                 |
| Transactions       | No `maxWait`/`timeout`; no P2002/P2024/P2034 mapping                                           | R-DAT-07: `maxWait` ≤ 2 s, `timeout` ≤ 5 s, bounded P2034 retry                                                                                                       |
| Pooling            | Adapter given only a connection string                                                         | R-DAT-05: per-profile connection budget. Under driver adapters this is likely the `pg` pool `max`, not URL `connection_limit`; record in ADR-013                      |
| Composition        | `export const prisma = createPrismaClient()` connects at import; users repository is in-memory | R-STK-03: no global singletons; one `compose.ts` per profile                                                                                                          |
| Migrations         | `prisma migrate dev` with app credentials                                                      | R-DAT-03/04: raw-SQL migrations, linter, drift check, one-off migrate task as `app_migrator`                                                                          |
| Local infra        | `docker-compose` has RabbitMQ only; Postgres is local/managed                                  | R-STK-08: real (not mocked) Postgres in integration tests; satisfied by a dedicated test database, no DB containers                                                   |
| Tooling            | npm; single `apps/api`; `tsconfig` lacks `exactOptionalPropertyTypes` and `noImplicitOverride` | R-STK-01/02: pnpm, `packages/contracts`, `packages/config`                                                                                                            |
| Pinning            | Prisma `^7.10.1`                                                                               | R-STK-03: exact minor pinned                                                                                                                                          |

## 2. Plan

### Phase 0: decisions and foundations

1. **Tooling baseline.** Migrate to pnpm; add `packages/contracts` and `packages/config`; tighten `tsconfig`; pin Prisma exactly; add lint bans (`$queryRawUnsafe`/`$executeRawUnsafe`, `no-explicit-any` under `modules/**`) and dependency-cruiser boundaries.
2. **Local and CI infra.** PostgreSQL is a local or managed instance addressed by env vars; no database containers are used (Redis/RabbitMQ containers are a separate decision). DB integration tests run against a configured test database. Define the four roles with separate env vars (`MIGRATE_DATABASE_URL`, `DATABASE_URL_SYSTEM`, `DATABASE_URL_PLATFORM`).
3. **ADR-001 Prisma proof (R-STK-06)**, run in CI:
   - `withTenant` and RLS under a pooler; composite FKs
   - partition-locked outbox batch claim; reward-unit `SKIP LOCKED` claim; batch upsert
   - interactive transaction timeouts
   - raw-SQL migrations with drift verification
4. **Ratify ADR-004, 005, 013, 014** and obtain legal sign-off (R-PRV-01). The ADR-013 pinning load test decides RDS Proxy versus PgBouncer.
5. **Observability baseline.** pino with redaction, OpenTelemetry, k6 harness.

**Exit:** signed ADRs, Prisma proof green in CI, capacity scenarios approved, DPA/controller roles agreed.

### Phase 1: platform foundation

1. Replace the placeholder `User` model with Identity (users, memberships, sessions) and Business.
2. Build `shared/database` (three clients plus `readDb`), `withTenant`, `runInTenantTransaction`, and Prisma error mapping.
3. Add scripts: `verify-rls`, `verify-db-objects`, `check-fk`, `check-ownership`, `connection-budget`.
4. Add outbox and inbox tables (partitioned `processed_events`) and the advisory-lock publisher with retention and age alerts.
5. Add `audit_log` (append-only, hash-chained).
6. Add the cross-tenant test harness (100% route coverage) and DB-level RLS tests.
7. Split runtime profiles (public-api, management-api, worker, scheduler) with `/livez`, `/readyz` and graceful shutdown.
8. Add server-side sessions, CSRF and MFA.

**Exit:** cross-tenant suite passes; outbox backlog alert live.

### Phases 2–6 (spec sequencing, binding per R-GOV-05)

- **2 Campaign management:** versioning, DB-backed scheduler with leases, CDN caching and purge.
- **3 Engagement with built-in trust:** rate limiting, WAF, CAPTCHA with accessible alternative, duplicate controls, consent, erasure and export. No public release without these.
- **4 Rewards and fraud:** reward units, reproducible draws, claim verification, fraud scoring, moderation.
- **5 Analytics and communication:** collector, projections with reconciliation, reports on replica, deliverability.
- **6 Operational maturity:** DR game day, chaos tests, pen test remediation, entitlements, integrations.

### DB-only implementation phase (Phase 0 DB items + Phase 1 DB foundation)

Scope is the database layer only (no auth/MFA, HTTP profiles, RabbitMQ publisher, Redis, Nuxt). Rule: every `id` and id-reference column is `uuid` (UUIDv7 defaults), enforced by `check-uuid`; `outbox_events.seq` is an ordering sequence, not an identifier.

1. Env/config: separate runtime, system, platform, read and migrate connection URLs; per-profile pool size.
2. Schema: `Business`, `User`, `Membership`, `OutboxEvent`, `ProcessedEvent`, `AuditLog`, with `@owner` annotations, composite tenant keys, `timestamptz`.
3. Migration: forced RLS and policies, grants per Appendix B.3; roles provisioned by a separate script (no passwords in SQL).
4. `shared/database`: client factories, branded `TenantContext`, `withTenant`, Prisma error mapping.
5. Scripts: `verify-rls`, `verify-db-objects`, `check-fk`, `check-ownership`, `check-uuid`, `connection-budget`.
6. Lint bans for unsafe raw queries and restricted client imports.
7. Tests: RLS isolation, `withTenant` under pooling, composite FKs (run against the test DB).

Applying migrations and provisioning roles requires explicit confirmation of the target database.

### Phase 1 progress

- Done: DB foundation (tenancy, RLS, roles, outbox/inbox/audit tables).
- Done (core auth PR): registration, email verification, Argon2id login with throttling and lock, PostgreSQL sessions (`__Host-sid`, idle 30 min / absolute 12 h), CSRF token + Origin checks, tenant derived from the active membership, session rotation on tenant switch. See `apps/api/src/modules/identity/MODULE.md`.
- Next: MFA (TOTP, recovery codes, step-up), invitations and ownership transfer, password reset, permission matrix and route metadata, outbox publisher, Redis session cache.

## 3. Open points

- The spec mandates pnpm; confirm before migrating from npm (touches CI, husky, lockfile).
- Confirm which DB role the current `DATABASE_URL` uses; it should not be an owner or superuser once `app_runtime` exists.
