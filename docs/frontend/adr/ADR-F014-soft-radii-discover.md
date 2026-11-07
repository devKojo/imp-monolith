# ADR-F014: Softer radii and the discovery page layout

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-FND-01, UI-A11Y-10, UI-PUB-01
- **Supersedes in part:** ADR-F013 decision 2 (radius scale)

## Context

The v2 radii (2/4/8/12 px) read as hard-edged. The public discovery page also still looked like a
demo next to the `public_discovery` reference.

## Decision

1. Radii become sm 6, md 10 (controls), lg 14 (cards, banners, tables), xl 20 (dialogs, search bar);
   chips and nav items are pills. `foundations.test.ts` pins the scale. Shadows are softer and
   layered.
2. `UiPublicShell` gets a sticky frosted header, a brand mark and a brand footer. `wide` now means
   full-bleed: the page owns its sections.
3. `UiSearchField` is one raised bar holding the field and the Search button. The bar carries the
   3:1 `border-strong` edge, so UI-A11Y-10 still holds.
4. `UiCampaignCard` gains a sponsor initial, a 2:1 media area and a hover lift (off under
   reduced motion).
5. `/discover` follows the reference layout. Not copied: invented figures, verified ticks, uptime
   and photography (see ADR-F013).

## Consequences

Every component picks up the new radii from tokens. Per-component radius overrides stay a smell.

## Addendum: compact density, footer, static text, paging

- Public pages run compact: controls 36 px (was 44), buttons 14 px and weight 500, a `sm` button
  size (32 px), and a smaller campaign card so four fit on a row. Inputs stay 16 px below 768 px so
  iOS does not zoom.
- `/discover` drops the sample-data banner and the "How entries stay fair" band. The brand is the
  plain wordmark "IMP", with no logo mark.
- `UiPublicShell` takes `footerColumns`, `footerTagline` and `copyright` for a link-column footer.
- All site text lives in `apps/web/app/i18n/staticSiteText.ts` (renamed from `en.ts`).
- Discover reveals 8 campaigns at a time: an intersection sentinel loads the next page on scroll
  and a visible "Show more" button covers keyboard use and blocked scripts.
