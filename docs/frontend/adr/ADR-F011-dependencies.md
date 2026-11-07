# ADR-F011: Frontend dependencies are pinned and at least 14 days old

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** R-STK-09, UI-PRF-01

## Decision

New dependencies are added only when the platform cannot reasonably provide the capability (ADR-F006
and ADR-F008 chose in-repo implementations over packages). Every added package is pinned to an exact
version published at least 14 days earlier. Dev dependencies added for the UI layer:
`@vitejs/plugin-vue` 6.0.10, `@vue/test-utils` 2.5.1, `axe-core` 4.14.0, `jsdom` 30.1.3.

## Consequences

- Check the publish date (`npm view <pkg> time`) before adding or bumping.
- Public-page script budget is 150 KB gzip (UI-PRF-01); prefer no new runtime dependencies for
  public routes, and lazy-hydrate below-the-fold interactive components.
