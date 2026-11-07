# ADR-F013: Design language v2 (Inter, tighter radii) and portal shells

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-FND-01, UI-FND-04, UI-A11Y-10, UI-PRT-01, UI-DSH-01
- **Supersedes in part:** ADR-F012 ("Inter is not adopted"), spec 3.4 radius scale

## Context

The product owner asked for the interface to match the supplied designs closely ("top 1% startup"
feel) and said the UI kit should be dropped where it holds that back. The kit was not the
obstacle; its tokens and shells were. Rather than discard 56 tested components, the tokens and
shells were changed so the same components render in the design language.

## Decision

1. **Font:** self-hosted Inter Variable (`@fontsource-variable/inter` 5.3.0, latin subset 48 KB, within
   the 60 KB limit of UI-FND-04). No third-party font requests (R-SEC-03). System fonts remain the
   fallback.
2. **Radii** are tighter than spec 3.4: sm 2, md 4 (controls), lg 8 (cards, dialogs), xl 12
   (stat, draw and feature cards). `foundations.test.ts` pins the new scale.
3. **Surfaces:** page background `#F9F9FF`, hairlines `#DBE2F9`, soft blue-tinted shadows.
4. **Inputs keep a visible 3:1 border** (`#868CA0`, 3.35:1 on white, 3.19:1 on the page colour).
   The designs relied on a faint shadow, which fails UI-A11Y-10; this is the one deliberate visual
   deviation. All 35 contrast pairs are gated by `tokens:build`.
5. **New components** (each with a registry entry, a gallery demo, and an axe pass): `UiAvatar`,
   `UiIconTile`, `UiStatCard`, `UiSegmentedControl`, `UiClaimCard`, `UiInstantWinCard`, `UiDrawCard`,
   `UiConsoleShell` (business) and `UiPortalShell` (participant). The two shells exist beside
   `UiDashboardShell` because the references use a different frame (sidebar plus slim header, and
   top tabs); they share `UiSidebarNav`, `UiSkipLink`, `UiButton` and `UiAvatar`.
6. `UiDataTable` gains `flush` for a table that sits inside a card.

## Not copied from the references

SSO, phone/OTP sign-in, "remember this device", and every invented claim (uptime, certifications,
cash totals, "YC"). Sector and workspace-URL fields have no backend. Dashboard figures are
**labelled sample data** and their actions are disabled until the campaign and participation APIs
exist.

## Consequences

- Platform pages now use Inter; the spec's system-font default (UI-FND-04) allows one self-hosted
  variable font, so this is within the rule.
- Tighter radii and the new surfaces apply to every existing component at once.
- Further visual changes go through tokens first; per-component overrides are a smell.
