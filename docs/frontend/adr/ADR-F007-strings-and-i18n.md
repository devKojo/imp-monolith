# ADR-F007: Strings live in a keyed catalogue (i18n-ready)

- **Status:** Accepted (interim); `@nuxtjs/i18n` adoption scheduled with the first page
- **Date:** 2026-11-07
- **Spec:** UI-CPY-01..06, UI-I18N-01..05, R-WEB-07

## Decision

Every string the library renders itself comes from `app/i18n/en.ts` through `uiText(key, params)`
(`{param}` placeholders). Content that belongs to the product (labels, titles, option text) is passed
by props or slots. A test fails if a component references a key that does not exist, if any system
state lacks copy, and if copy breaks the terminology rules ("Tenant", bare "OK"/"Submit").

## Consequences

- Layouts must tolerate about 40% longer text; no fixed-height text containers.
- When `@nuxtjs/i18n` is installed, `uiText` becomes a thin wrapper over `t`, and `en.ts` becomes
  the default locale file. Component code does not change.
- Dates and numbers use `Intl` with the campaign locale and always show the time zone
  (`utils/datetime.ts`).
