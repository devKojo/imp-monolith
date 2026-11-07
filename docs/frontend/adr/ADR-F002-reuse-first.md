# ADR-F002: Reuse first: compose, then extend, then add

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-GOV-01, UI-GOV-02, UI spec section 1.2 ("consistent and predictable")

## Context

The goal is to avoid duplicated UI and the cost of rebuilding similar components. The spec already
treats consistency as a principle: one pattern per problem, same component, position and wording.

## Decision

1. **Order of preference:** compose existing components; extend an existing one with a prop or
   variant; add a new component only when neither works.
2. **A component exists only if it is registered and demonstrated:** every file in
   `app/components` needs an entry in `app/gallery/registry.ts` and a `<GalleryBlock>` in the
   gallery. `registry.test.ts` fails otherwise.
3. **Composition is derived, not declared:** `scripts/build-catalogue.ts` reads imports and writes
   "Composes" and "Used by" into the gallery and `docs/frontend/component-catalogue.md`, so the
   reuse picture cannot drift.
4. **Shared building blocks are tested for reuse** (`UiFormField` behind every labelled control,
   `UiDialog` behind every modal, `UiProgress` behind every progress display, `UiButton` for every
   action) and **native controls have one owner** each.
5. **Patterns beat new components:** destructive confirmation, step-up, conflict, system states and
   reordering each exist once and are parameterised.

## Consequences

- Adding a component costs a registry entry and a demo; that cost is deliberate friction.
- Reviewers check "could this be composed?" first. PRs cite the components reused.
- The catalogue is generated; edit the registry or sources, never the markdown.
