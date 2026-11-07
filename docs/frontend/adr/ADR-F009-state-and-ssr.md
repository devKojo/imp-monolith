# ADR-F009: SSR-safe state; public pages SSR, authenticated pages SPA

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** R-WEB-02, R-WEB-03, R-WEB-04, R-WEB-08, UI-PUB-03, UI-PUB-06, UI spec 18.1

## Decision

- **No module-level mutable state** in code that can run on the server. Library state is created per
  app instance and shared with `provide/inject` (for example `UiToaster` provides the toast store;
  `useToast()` injects it and throws without a toaster). Application state uses `useState` or Pinia.
- **Route classes** follow the architecture spec: marketing prerendered; `/c/:slug` SSR with edge
  caching and no per-user data or cookies; `/app/**` and `/admin/**` SPA (`ssr: false`) with no-store
  shells. Route rules are set in `apps/web` when those routes are created.
- **Participant form state stays in memory** and is never written to local/session storage. One
  `submissionToken` is generated per entry attempt and reused on every retry; the UI never silently
  resubmits with a new token.
- Components are safe to render on the server: browser APIs (`document`, `navigator`) are only used
  inside event handlers or lifecycle hooks.

## Consequences

- A cross-request leakage test (R-WEB-04) is required once pages exist.
- Pinia, `nuxt-security` (CSP nonces) and `@nuxt/image` are added together with their first
  consumers, not speculatively.
