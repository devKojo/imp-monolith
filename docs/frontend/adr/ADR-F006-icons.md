# ADR-F006: One in-repo inline SVG icon registry

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-FND-06, UI-GOV-03 (icon set), R-STK-09

## Decision

Icons are 24 x 24, 2 px round-stroke inline SVG paths in `app/icons.ts`, rendered by `UiIcon`. No
icon fonts and no third-party icon package. `IconName` is a typed union, so using an icon that is not
in the registry is a compile error. `UiIcon` is decorative (`aria-hidden`) unless given a `label`.

## Consequences

- No dependency to audit or version-pin; the bundle only carries icons that are used.
- Adding an icon means adding a path to one file. If the set outgrows hand-maintenance, swap the
  registry's source for an inline-SVG set (for example Lucide) behind the same `UiIcon` API.
