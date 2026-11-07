# ADR-F012: External design references are reconciled with the specs, then folded into the library

- **Status:** Accepted
- **Date:** 2026-11-07
- **Spec:** UI-GOV-01, UI-GOV-02, UI-FND-01, UI-CPY-03, R-TEN-06, R-IAM-01, R-SEC-03, R-PRV-01

## Context

Screens designed outside this repository (sign-in, sign-up, business registration and public
discovery, exported from a design tool with a shared DESIGN.md) are the input for the auth and
discovery pages. They are inspiration and intent, not a source of requirements: where they disagree
with the architecture or UI specifications, the specifications win (the UI spec says so itself).

## Decision

Every design reference is processed in four steps, and the result is recorded here.

1. **Reconcile** each element against the specs: adopt, adapt, or reject with a reason.
2. **Extract** what is genuinely new (patterns, tokens) into the library; reuse what exists.
3. **Build the pages from library components only** (ADR-F002); no page-local copies.
4. **Record** where each new component came from (`origin` in `gallery/registry.ts`).

## Outcome for the sign-in, sign-up, business-registration and discovery screens

### Adopted (and added to the library)

| Seen in the designs                          | Became                                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Centred card, brand, title, footer strip     | `UiAuthShell` (narrow and wide-with-aside)                           |
| Security pill, portal tag, type/time tags    | `UiBadge` (and `UiStatusChip` is now a badge: one pill, not two)     |
| "or sign in with email" separator            | `UiDivider`                                                          |
| Password visibility toggle + rules checklist | `UiPasswordField` (rules passed in; met/not-met in text, not colour) |
| Leading icons in inputs, label-row link      | `UiTextInput` `icon`/`suffix`, `UiFormField` `labelAside`            |
| Category pills                               | `UiFilterChips` (toggle buttons, selected adds a check)              |
| Search bar                                   | `UiSearchField` (`role="search"`, hidden label, visible button)      |
| Campaign card                                | `UiCampaignCard` (one link per card, absolute end time on `<time>`)  |
| Value-prop cards                             | `UiFeatureTile`                                                      |
| Header with navigation and CTA buttons       | `UiPublicShell` `nav` / `actions` / `wide`                           |
| CTA that is a link but looks like a button   | `UiButton` `to`, `UiLink` `bare`                                     |
| Spinner while submitting                     | `UiButton` loading spinner                                           |
| Hover/pressed colours, elevation, tracking   | tokens (28 contrast pairs gated), `label` and `label-sm` styles      |

### Adapted

- **Superseded by ADR-P001:** participants now have their own accounts and sign-up; business
  registration is a separate single form. The original reasoning is kept below for history.
- **Sign-up is two steps for a business account**, not a participant portal. Participants have no
  accounts in this platform (tenant-scoped participants, R-TEN-06, ADR-009; they verify per
  campaign). The "account" screen becomes step 1 and "business registration" step 2.
- **Registration records the agreement** (terms + data processing addendum) with its version in the
  audit log, because a business cannot be activated without it (R-PRV-01). The designs only had a
  checkbox.
- **Password rules** follow the server policy (12 to 128 characters, not the email name, not one
  repeated character, plus a server-side breach check), not the 8-character rule in the sign-up
  design or the 14-character rule in the registration design.
- **Discovery filters** use the spec's experience types (quiz, poll, survey, vote, giveaway)
  instead of "Hardware Drop", "Beta Access" and similar. Entering a campaign goes to its public page
  (`/c/:slug`); there is no sign-in modal.
- **Inputs keep a visible border** (3:1 non-text contrast, spec 3.2), where the designs relied on a
  faint shadow.

### Rejected, with reasons

| Seen in the designs                                                                                                               | Why not                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google / GitHub SSO, phone-OTP sign-in, magic links                                                                               | Not in the identity spec or backend (password + MFA for business users); candidates for a later ADR                                                             |
| "Remember this device for 30 days"                                                                                                | Contradicts the session policy (30 minute idle, 12 hour absolute, R-IAM-01)                                                                                     |
| "Forgot password?" link                                                                                                           | No reset flow yet; a dead link is worse than none (the slot exists in `UiFormField`)                                                                            |
| Marketing claims: "YC S24", "$4.2M distributed", "99.98% uptime", "ISO 27001", "SOC 2", escrow, "100% cryptographically verified" | Not supported by the specs or any evidence; invented proof erodes trust (UI-CPY-03). A test blocks them from the copy                                           |
| Testimonials and avatar photos                                                                                                    | Fabricated content                                                                                                                                              |
| Tailwind CDN, Material Symbols and Google Fonts at runtime                                                                        | Third-party scripts and fonts are prohibited by default (R-SEC-03, ADR-F003, ADR-F006); the UI uses tokens, its own icons and the system font stack (UI-FND-04) |
| Industry sector and workspace URL fields                                                                                          | No backend field or requirement; slugs belong to campaigns, not businesses (R-TEN-07)                                                                           |
| Phone number at sign-up                                                                                                           | Not needed for a business account; collecting it fails the "ask only what is needed" principle                                                                  |
| Optional marketing opt-in at sign-up                                                                                              | Nothing records or honours it yet; a checkbox that does nothing misleads                                                                                        |

## Consequences

- New designs go through the same four steps. Reviewers expect the PR to list what was adopted,
  adapted and rejected, and to cite the registry `origin` for new components.
- The DESIGN.md palette is the same as our tokens; its extra values (hover/pressed, shadows) are
  now in `tokens.json`. Its font (Inter) is not adopted; the dashboard MAY use one self-hosted
  variable font of at most 60 KB (UI-FND-04), which needs its own decision.
- The rejected items are product questions, not permanent no's. Each can return with a backend
  requirement and an ADR (SSO, passwordless, forgot password, marketing consent).
