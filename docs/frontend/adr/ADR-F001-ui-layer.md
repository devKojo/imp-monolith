# ADR-F001: Reusable UI lives in the `@imp/ui` Nuxt layer

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-FND-02, R-STK-02, R-STK-07

## Context

The UI spec requires the component library to live in a dedicated Nuxt layer so that public pages,
the business dashboard and the admin console share one design system. The architecture spec fixes a
workspace layout with `apps/web` and `packages/*`.

## Decision

`packages/ui` is a Nuxt layer (`@imp/ui`) extended by `apps/web` via `extends: ['../../packages/ui']`.
It owns tokens, base CSS, components (`Ui*`), composables, the string catalogue and the gallery.
`apps/web` owns routes and feature code only. npm workspaces now include `packages/*`.

## Consequences

- A component written in `apps/web` that is not feature-specific is a defect: move it to the layer.
- Layer components import from `vue` explicitly (no Nuxt auto-imports) so they can be unit tested
  without Nuxt; Nuxt-only pieces (NuxtLink) are resolved at runtime with a plain-anchor fallback.
- The repo uses npm workspaces today; the spec mandates pnpm (R-STK-02). Migrating is tracked
  separately and does not change this decision.
