# ADR-F010: Accessibility is a definition-of-done item with automated coverage

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-A11Y-01..15, UI-GOV-01, UXA-001..005, R-WEB-10, R-TST-01

## Decision

WCAG 2.2 AA is a design constraint, not a testing phase. Concretely, for the library:

- Native elements first (`button`, `input`, `select`, `dialog`, `fieldset`); ARIA only where there is no native equivalent (tabs, switch, progressbar, live regions).
- Persistent labels, hints and errors wired by `UiFormField`; error summary with field links.
- One focus treatment (2 px ring, 2 px offset, 3:1) and `scroll-padding` so sticky UI never hides focus.
- Targets of 44 px (public) and 32 px (dashboard) via `--ui-control-target`.
- Reduced motion neutralises all animation globally; transitions are 200 ms or less.

Automated coverage today: contrast gate (tokens), axe-core over every gallery demo, behaviour tests
for keyboard and ARIA contracts (tabs, dialogs, OTP, timers, tables, permission gate), lint rules.

## Findings so far

The axe sweep caught a real defect during this work: `UiButton` forwarded attributes such as
`aria-expanded` to its layout wrapper `<span>`. Fixed with `inheritAttrs: false` and covered by the
sweep.

## Consequences / still required

- jsdom cannot compute layout or contrast: add Playwright with axe on core journeys, reflow checks
  at 320 px (UXA-004), target-size checks (UXA-005) and visual snapshots at 360/768/1280 px.
- Manual audits (NVDA, VoiceOver iOS, TalkBack, keyboard-only, 200% zoom) remain required before
  launch (UI-A11Y-15, UXA-002, UXA-015).
