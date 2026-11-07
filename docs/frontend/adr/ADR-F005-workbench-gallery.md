# ADR-F005: The workbench is the in-repo `/ui` gallery (development only)

- **Status:** Accepted as a **deviation** from UI-FND-02 / UI-GOV-03 (Histoire or Storybook); needs
  Tech Lead and Design confirmation
- **Date:** 2026-11-07
- **Spec:** UI-FND-02, UI-GOV-02, UI-GOV-03 (workbench tool), UXA-001

## Context

The spec names Histoire or Storybook for the component workbench, with axe checks and visual
regression at 360, 768 and 1280 px. The request for this repo was a display page inside the app
that shows every component, so developers reuse instead of rebuild.

## Decision

The workbench is a set of Nuxt pages in the layer (`/ui`, `/ui/foundations`, `/ui/components`,
`/ui/states`, `/ui/screens`), driven by `app/gallery/registry.ts` and demo files. Pages are added
to the router only when `NODE_ENV !== 'production'` or `UI_GALLERY=1`, so they are not served in
production. axe-core runs over every demo in `tests/a11y.test.ts`.

## Consequences

- Zero extra tooling; the gallery uses the same Nuxt, tokens and CSS as the product, so it cannot
  drift from how components really render.
- Missing against the spec: isolated story files, visual regression snapshots and a hosted
  workbench for designers. Playwright screenshot tests at the three widths can be added against
  `/ui/components`, `/ui/states` and `/ui/screens` without changing the gallery.
- If Histoire or Storybook is later required, the registry and demos convert to stories mechanically.
