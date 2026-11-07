# ADR-F008: Charts are an in-house accessible SVG component

- **Status:** Accepted for the initial release; revisit if requirements outgrow it
- **Date:** 2026-11-07
- **Spec:** UI-A11Y-10, UI-DSH-08, UI-GOV-03 (chart library: "SVG-based with accessibility evaluation")

## Decision

`UiChart` renders line, bar and funnel charts as inline SVG with no charting dependency. It is built
to the accessibility rules instead of retrofitting them: a unique marker and dash pattern per series,
hatched bar fills, direct labels, a mandatory plain-language `summary`, a data-table toggle, and
labels for "approx." and "Provisional/Final". Palette comes from the chart tokens (ADR-F004).

## Consequences

- Smaller public/dashboard bundles and no third-party licence or supply-chain surface.
- Limited features (no zoom, tooltips or stacked series). If analytics needs them, evaluate an SVG
  library against the same checklist (keyboard access, data table, patterns, contrast) and replace
  the internals behind the same props.
