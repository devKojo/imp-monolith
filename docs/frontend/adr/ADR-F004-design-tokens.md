# ADR-F004: Design tokens are defined once, generated, and contrast-gated

- **Status:** Accepted, with one recorded waiver (chart series 5)
- **Date:** 2026-11-07
- **Spec:** UI-FND-01, UI-FND-10, UXA-003, UI spec 3.2, UI-A11Y-10

## Decision

`packages/ui/tokens/tokens.json` is the only place values are defined. `scripts/build-tokens.ts`
generates `app/assets/css/tokens.css` and `app/tokens.generated.ts` (types and values). Components
consume **semantic** tokens (`text-primary`, `action-primary`, `danger-text`, ...), never raw ones.
The `contrast` list in the JSON holds every foreground/background pair with its threshold (4.5:1
text, 3:1 non-text); the build and `foundations.test.ts` fail if any pair is below it. Generated
files are committed and `tokens:check` fails when they are stale.

## Recorded waiver: chart series 5 (`#56B4E9`)

The UI spec's own chart palette gives series 5 a contrast of **2.31:1** on white, while UI-A11Y-10
requires 3:1 for graphical objects. Series 1 to 4 pass. Rather than loosen the rule silently or
change a design value without approval, the pair carries an explicit `waiver` (floor 2.3:1) that the
build reports, and a test caps waivers at one and requires them to cite this ADR. Mitigation:
every series already has a unique marker, dash pattern and direct label, so colour is never the only
signal.

**Action for Design:** approve the waiver or supply a replacement colour at 3:1 or better, then
remove the waiver.

## Consequences

- Changing a colour is a one-file edit plus `npm run tokens:build`; a failing pair blocks the build.
- Tenant brand colours (spec 3.6) must be validated against the same function at save time; reuse
  `scripts/lib/contrast.ts` logic in the API/builder when that feature is built.
