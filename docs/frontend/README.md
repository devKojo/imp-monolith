# Frontend practices

Active decisions and working rules for everything under `apps/web` and `packages/ui`. They derive
from the _UI/UX Design Specification v1.0_ (UI-\* ids) and the _Architecture Specification v2.0_
(R-\* ids). **Read this before writing frontend code, and cite the decision you are applying in PR
descriptions** (for example "reuses `UiFormField` per ADR-F002").

## Where things live

```
packages/ui/                 Nuxt layer (@imp/ui): everything reusable
  tokens/tokens.json         design tokens (single source)
  app/assets/css/            tokens.css (generated), base.css
  app/components/Ui*.vue     the component library
  app/composables/           useToast, useUiText
  app/i18n/en.ts             string catalogue
  app/gallery/               registry.ts, demos, gallery pages (/ui, dev only)
  scripts/                   build-tokens, build-catalogue, lint-ui
  tests/                     unit, behaviour and axe tests
apps/web/                    Nuxt app: routes and feature code only; extends @imp/ui
  app/modules/<name>/        feature code mirroring API modules (composables, feature components)
docs/frontend/               this file, ADRs, generated component-catalogue.md
```

## Active decisions

| ID                                                  | Decision                                                                     | Enforced by                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| [ADR-F001](adr/ADR-F001-ui-layer.md)                | Reusable UI lives in the `@imp/ui` Nuxt layer, not in the web app            | Layout, code review                         |
| [ADR-F002](adr/ADR-F002-reuse-first.md)             | Reuse first: compose, then extend, then (rarely) add a component             | `registry.test.ts`, catalogue check, review |
| [ADR-F003](adr/ADR-F003-css-tooling.md)             | Scoped CSS + token custom properties + logical properties                    | `lint-ui`                                   |
| [ADR-F004](adr/ADR-F004-design-tokens.md)           | Tokens defined once in JSON, generated, contrast-gated                       | `tokens:check`, `foundations.test.ts`       |
| [ADR-F005](adr/ADR-F005-workbench-gallery.md)       | The workbench is the in-repo `/ui` gallery (dev only)                        | Gallery blocks required per component       |
| [ADR-F006](adr/ADR-F006-icons.md)                   | One in-repo inline SVG icon registry                                         | Typed `IconName`                            |
| [ADR-F007](adr/ADR-F007-strings-and-i18n.md)        | Strings live in a keyed catalogue (i18n-ready)                               | `foundations.test.ts`                       |
| [ADR-F008](adr/ADR-F008-charts.md)                  | Charts are an in-house accessible SVG component                              | Component tests                             |
| [ADR-F009](adr/ADR-F009-state-and-ssr.md)           | SSR-safe state; public pages SSR, authenticated pages SPA                    | Review, R-WEB-04 test (later)               |
| [ADR-F010](adr/ADR-F010-accessibility-and-tests.md) | Accessibility is a definition-of-done item with automated axe coverage       | `a11y.test.ts`, CI                          |
| [ADR-F011](adr/ADR-F011-dependencies.md)            | Frontend dependencies are pinned and at least 14 days old                    | Review (R-STK-09)                           |
| [ADR-F012](adr/ADR-F012-design-references.md)       | External designs are reconciled with the specs, then folded into the library | PR checklist, registry `origin`             |

## Rules while developing

1. **Look before you build.** Open `/ui/components` (or `docs/frontend/component-catalogue.md`).
   Most screens are compositions; `/ui/screens` shows the section 15 wireframes assembled from
   library parts.
2. **Compose, then extend, then add.** Order of preference: combine existing components; add a
   prop or variant to an existing one; only then create a new component. A new component needs a
   registry entry, a gallery demo block and passes review (ADR-F002).
3. **One native control, one owner.** Do not write a raw `<button>`, `<input>` or `<select>` in a
   feature; use `UiButton`, `UiTextInput`, `UiSelect` and the field components. Raw controls live
   only in the components that own them (tested).
4. **Tokens only.** No hex/rgb colours, no px font sizes or spacing, no `left`/`right`; use
   `var(--ui-*)` and logical properties. `npm run lint:ui -w @imp/ui` fails otherwise.
5. **No loose strings.** Words the library renders come from `i18n/en.ts`; words that belong to
   the product are passed as props/slots. Buttons are verb + object; never "OK" or "Submit";
   "Business" not "Tenant"; errors say what to do next and never blame the user.
6. **Every state is designed.** Loading, empty, error, forbidden, offline, paused, ended and the
   rest of spec section 11 come from `UiSystemState`, `UiSkeleton` and `UiEmptyState`. Do not
   hand-roll error screens.
7. **Status is never colour alone.** Use `UiStatusChip` with the fixed vocabularies in
   `status-vocabulary.ts`. Add statuses there, not as one-off chips.
8. **Accessible by default.** Native elements first; visible labels; errors in text next to the
   field and in an error summary; focus management for dialogs and route changes; 44 px targets on
   public pages and 32 px in the dashboard. `a11y.test.ts` must stay green.
9. **SSR-safe state.** No module-level mutable state in code that runs on the server. Use
   `provide/inject`, `useState` or Pinia (ADR-F009). Participant form state stays in memory and is
   never written to browser storage.
10. **Typed contracts only.** The frontend consumes the API through the generated client from
    `packages/contracts`; never hand-write DTOs. Render rich text only from the sanitised block
    model; `v-html` is prohibited.
11. **Permission-honest UI.** Hide what a role can never do, explain what state or role blocks
    (`UiPermissionGate`), and handle 403 gracefully. The server decides; the client only helps.

## Commands

```bash
npm run dev -w @imp/web            # app + gallery at http://localhost:3001/ui (dev only)
npm run tokens:build -w @imp/ui    # regenerate CSS/TS after editing tokens/tokens.json
npm run catalogue:build -w @imp/ui # regenerate composition data + component-catalogue.md
npm run check -w @imp/ui           # tokens + catalogue freshness + lint-ui
npm test -w @imp/ui                # tokens, lint, registry, behaviour and axe tests
```

## Adding a component (checklist)

- [ ] Searched the gallery/catalogue; nothing existing can be composed or extended.
- [ ] `app/components/UiThing.vue`: explicit `vue` imports, scoped CSS with tokens only, props
      typed, strings from the catalogue, native semantics, all states handled.
- [ ] Entry in `app/gallery/registry.ts` (category, summary, spec refs, states, a11y note).
- [ ] `<GalleryBlock name="UiThing">` in the right demo file showing every state.
- [ ] Behaviour test in `tests/components.test.ts` for anything non-trivial.
- [ ] `npm run catalogue:build -w @imp/ui` and `npm run check -w @imp/ui` pass; commit generated files.

## Known gaps (tracked, not hidden)

- **Discovery has no backend yet.** `/discover` runs on labelled sample data; the API it needs is in
  [discovery-contract.md](discovery-contract.md) and needs a spec amendment (no listing endpoint and
  no discovery route in the information architecture).
- **Not built from the auth designs** (see ADR-F012): SSO, phone/OTP sign-in, forgot password,
  resend verification, MFA enrolment, an idle-session warning (UI-A11Y-07).
- The API client in `apps/web/app/modules/auth/api.ts` and its validation mirror are hand-written
  until `packages/contracts` exists (R-STK-04).

- Visual regression snapshots at 360/768/1280 px and Playwright axe on real journeys (UI-FND-02,
  UXA-001, UXA-004/005) are not wired yet; the jsdom axe sweep covers structure only, and colour
  contrast is covered by the token gate.
- `@nuxtjs/i18n`, `nuxt-security` (CSP nonces), `@nuxt/image` and Pinia are not installed yet
  (ADR-F007, ADR-F009); add each with its first consumer.
- Chart series 5 colour is below 3:1 and carries a documented waiver pending design sign-off
  (ADR-F004).
- The block editor, landing-page blocks and the permissions-driven navigation filter are
  patterns to build on top of `UiReorderableList` and `UiSidebarNav` when those features start.
