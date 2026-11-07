# ADR-F003: Scoped CSS, token custom properties and logical properties

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-GOV-03 (CSS tooling), UI-FND-01, UI-FND-03, UI-I18N-04, UI-FND-10

## Context

UI-GOV-03 leaves "token-based utility CSS or scoped CSS" open. The spec requires semantic tokens
only, logical properties, a 150 KB script budget on public pages, and a dark theme that can be added
later without component changes.

## Decision

Scoped component CSS that reads CSS custom properties generated from the tokens (`--ui-color-*`,
`--ui-space-*`, `--ui-font-*`, ...). No utility-class framework. Layout uses logical properties
(`inline-size`, `margin-inline`, `padding-block`, `inset-inline-start`). Tenant theming overrides the
brand tokens only (spec 3.6). Semantic tokens reference raw tokens, so a `[data-theme="dark"]`
override can be added later.

`packages/ui/scripts/lib/lint-ui.ts` rejects: hex/rgb/hsl colours, px/rem/em font sizes and
spacing, physical left/right properties, transitions over 200 ms, `v-html`, unscoped component
styles. It runs in `npm run check` and in `foundations.test.ts`.

## Consequences

- Zero runtime CSS framework cost; styles are co-located and cannot leak.
- The lint is a focused regex check, not a full CSS parser; adopt stylelint if rules outgrow it.
- Media-query breakpoints use literal widths (CSS cannot read custom properties there); they are
  generated into a comment in `tokens.css` as the reference values.
