<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue';
import { uiText } from '../composables/useUiText';
import { tokens } from '../tokens.generated';
import UiButton from './UiButton.vue';
import UiPagination from './UiPagination.vue';

export type ChartSeries = { name: string; points: Array<{ label: string; value: number }> };

/**
 * SVG chart (UI-A11Y-10, ADR-F008). Never colour alone: every series has its own marker and dash
 * pattern and a direct label at its end; bars, slices and steps are solid fills in the series colours, named
 * by a label or legend entry beside them. Always paired with a text
 * summary and a data-table toggle. Approximate and provisional figures are labelled.
 *
 * Interactive: pointing at, tapping or tabbing to a column (line, area, bar), a slice (donut) or a step
 * (funnel) opens a tooltip with the full name and every value. Names too long for the axis or the legend are
 * shortened with an ellipsis and shown in full in the tooltip and the data table. Escape closes the tooltip.
 * Pass full labels: the chart shortens them itself.
 */
const props = defineProps<{
  type: 'line' | 'area' | 'bar' | 'funnel' | 'donut';
  title: string;
  series: ChartSeries[];
  /** Plain-language reading of the chart: required, shown under it. */
  summary: string;
  approx?: boolean;
  status?: 'provisional' | 'final';
  /**
   * Rows per page of the data table; more rows than this are paged with page controls. Over time (line,
   * area, bar) the table opens on the most recent page; otherwise on the first. Leave unset to show every
   * row on one page.
   */
  tableLimit?: number;
  /** Text in the middle of a donut (usually the total). */
  centerText?: string;
}>();

const showTable = ref(false);
const picked = ref<number | null>(null);
const W = 600;
const H = 280;
const M = { top: 16, end: 96, bottom: 36, start: 48 };
const plotW = W - M.start - M.end;
const plotH = H - M.top - M.bottom;

/** Shortens a name to fit, with an ellipsis; the full name stays in the tooltip and the table. */
const AXIS_MAX = 12;
const LEGEND_MAX = 26;
const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;

const labels = computed(() => props.series[0]?.points.map((p) => p.label) ?? []);
// Many labels would overlap, so the axis names every n-th one; the data table below lists them all.
const axisLabels = computed(() => {
  const step = Math.max(1, Math.ceil(labels.value.length / 8));
  return labels.value.map((l, i) => ({ l, i })).filter(({ i }) => i % step === 0);
});
const max = computed(() => {
  const m = Math.max(1, ...props.series.flatMap((s) => s.points.map((p) => p.value)));
  const pow = 10 ** Math.floor(Math.log10(m));
  // A multiple of four, so the five gridlines (0, 1/4 ... 1) fall on whole numbers.
  return Math.ceil((Math.ceil(m / pow) * pow) / 4) * 4;
});
const x = (i: number) =>
  M.start + (labels.value.length <= 1 ? plotW / 2 : (i / (labels.value.length - 1)) * plotW);
const y = (v: number) => M.top + plotH - (v / max.value) * plotH;
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max.value * f)));
const style = (i: number) => tokens.chartSeries[i % tokens.chartSeries.length]!;
const stroke = (i: number) => `var(--ui-chart-${(i % 5) + 1})`;
const path = (s: ChartSeries) =>
  s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(p.value)}`).join(' ');
const barW = computed(() =>
  Math.min(40, plotW / Math.max(1, labels.value.length) / (props.series.length + 0.5)),
);
// Steps are drawn up to this width, which leaves room for the label to the right of the longest one.
const funnelMax = plotW * 0.5;
const funnel = computed(() => {
  const pts = props.series[0]?.points ?? [];
  const top = pts[0]?.value || 1;
  return pts.map((p, i) => ({
    ...p,
    pct: Math.round((p.value / top) * 100),
    y: M.top + i * (plotH / Math.max(1, pts.length)),
    h: plotH / Math.max(1, pts.length) - 8,
  }));
});
// The data table: every row, or just a few with the rest behind "View breakdown".
const overTime = computed(
  () => props.type === 'line' || props.type === 'area' || props.type === 'bar',
);
const pageSize = computed(() => props.tableLimit || Math.max(1, labels.value.length));
const pageCount = computed(() => Math.max(1, Math.ceil(labels.value.length / pageSize.value)));
const paged = computed(() => !!props.tableLimit && labels.value.length > props.tableLimit);
const tablePage = computed({
  get: () => Math.min(picked.value ?? (overTime.value ? pageCount.value : 1), pageCount.value),
  set: (v: number) => {
    picked.value = v;
  },
});
const tableRows = computed(() => {
  const all = labels.value.map((label, i) => ({ label, i }));
  return all.slice((tablePage.value - 1) * pageSize.value, tablePage.value * pageSize.value);
});

// Donut: each slice is a ring segment drawn as a dashed circle, so a single 100% slice still works.
const D = { cx: 150, cy: H / 2, r: 82, w: 44 };
const circumference = 2 * Math.PI * D.r;
const donut = computed(() => {
  const pts = props.series[0]?.points ?? [];
  const total = pts.reduce((n, p) => n + p.value, 0);
  let acc = 0;
  return {
    total,
    slices: pts.map((p, i) => {
      const len = total > 0 ? (p.value / total) * circumference : 0;
      // The middle of the slice, as an angle from twelve o'clock, to anchor its tooltip.
      const mid = ((acc + len / 2) / circumference) * 2 * Math.PI - Math.PI / 2;
      const slice = {
        ...p,
        i,
        pct: total > 0 ? Math.round((p.value / total) * 100) : 0,
        dash: `${Math.max(0, len - (len > 4 ? 3 : 0))} ${circumference}`,
        offset: -acc,
        at: { x: D.cx + D.r * Math.cos(mid), y: D.cy + D.r * Math.sin(mid) },
      };
      acc += len;
      return slice;
    }),
  };
});
const area = (s: ChartSeries) => `${path(s)} L${x(s.points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
const statusText = computed(() =>
  props.status === 'provisional'
    ? uiText('chart.provisional')
    : props.status === 'final'
      ? uiText('chart.final')
      : '',
);

// ---- the tooltip: where it points (in chart units), what it names, and what it says
type Tip = { x: number; y: number; title: string; lines: string[]; col: number | null };
const tip = ref<Tip | null>(null);
const show = (t: Tip) => {
  tip.value = t;
};
const hide = () => {
  tip.value = null;
};
const n = (v: number) => v.toLocaleString();

const columns = computed(
  () => props.type === 'line' || props.type === 'area' || props.type === 'bar',
);
/** Width each column of a time-style chart owns, so a short bar is as easy to point at as a tall one. */
const colW = computed(() => (labels.value.length <= 1 ? plotW : plotW / (labels.value.length - 1)));
const columnTip = (j: number): Tip => {
  const values = props.series.map((s) => s.points[j]?.value ?? 0);
  return {
    x: x(j),
    y: y(Math.max(0, ...values)),
    title: labels.value[j] ?? '',
    lines: props.series.map((s, i) => `${s.name}: ${n(values[i] ?? 0)}`),
    col: j,
  };
};
const columnLabel = (j: number) => {
  const t = columnTip(j);
  return `${t.title}. ${t.lines.join(', ')}`;
};
const sliceTip = (sl: (typeof donut.value.slices)[number]): Tip => ({
  x: sl.at.x,
  y: sl.at.y,
  title: sl.label,
  lines: [`${n(sl.value)} (${sl.pct}%)`],
  col: null,
});
const stepTip = (f: (typeof funnel.value)[number]): Tip => ({
  x: M.start + (f.pct / 100) * funnelMax,
  y: f.y + f.h / 2,
  title: f.label,
  lines: [`${n(f.value)} (${f.pct}%)`],
  col: null,
});
/** A shortened name that can show its full text on hover. */
const nameTip = (full: string, atX: number, atY: number): Tip => ({
  x: atX,
  y: atY,
  title: full,
  lines: [],
  col: null,
});
/**
 * One handler for the whole chart: marks carry what they stand for in a data attribute (a column, a slice, a
 * step, or a shortened axis name), so the page does not need a listener on every mark.
 */
function onPoint(e: Event) {
  const el = (e.target as Element | null)?.closest?.(
    '[data-col],[data-slice],[data-step],[data-axis]',
  ) as (HTMLElement | SVGElement) | null | undefined;
  if (!el) return hide();
  const d = el.dataset;
  if (d.col !== undefined) return show(columnTip(Number(d.col)));
  if (d.slice !== undefined) {
    const sl = donut.value.slices[Number(d.slice)];
    return sl ? show(sliceTip(sl)) : hide();
  }
  if (d.step !== undefined) {
    const f = funnel.value[Number(d.step)];
    return f ? show(stepTip(f)) : hide();
  }
  const i = Number(d.axis);
  return show(nameTip(labels.value[i] ?? '', x(i), H - 24));
}
// Where the tooltip sits: above its point, kept inside the chart at the edges.
const tipStyle = computed<CSSProperties>(() => {
  const t = tip.value;
  if (!t) return {};
  const left = (t.x / W) * 100;
  const shift = left > 70 ? '-100%' : left < 30 ? '0%' : '-50%';
  return {
    insetInlineStart: `${left}%`,
    insetBlockStart: `${(t.y / H) * 100}%`,
    transform: `translate(${shift}, calc(-100% - 10px))`,
  };
});
</script>

<template>
  <figure class="ui-chart" @keydown.esc="hide">
    <figcaption class="ui-chart__head">
      <span class="ui-text-h3">{{ title }}</span>
      <span v-if="approx || statusText" class="ui-text-body-s ui-text-hint">{{
        [approx ? uiText('chart.approx') : '', statusText].filter(Boolean).join(' · ')
      }}</span>
      <UiButton variant="tertiary" @click="showTable = !showTable">{{
        showTable ? uiText('chart.showChart') : uiText('chart.showTable')
      }}</UiButton>
    </figcaption>

    <div v-show="!showTable" class="ui-chart__plot">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="`${title}. ${summary}`"
        class="ui-chart__svg"
        @mouseover="onPoint"
        @focusin="onPoint"
        @click="onPoint"
        @mouseleave="hide"
        @focusout="hide"
      >
        <g v-if="type !== 'funnel' && type !== 'donut'">
          <g v-for="t in ticks" :key="t">
            <line
              :x1="M.start"
              :x2="W - M.end"
              :y1="y(t)"
              :y2="y(t)"
              stroke="var(--ui-color-border)"
            />
            <text :x="M.start - 6" :y="y(t) + 4" text-anchor="end" class="ui-chart__tick">
              {{ t }}
            </text>
          </g>
          <line
            v-if="tip && tip.col !== null"
            :x1="x(tip.col)"
            :x2="x(tip.col)"
            :y1="M.top"
            :y2="y(0)"
            stroke="var(--ui-color-text-hint)"
            stroke-dasharray="3 3"
          />
          <text
            v-for="{ l, i } in axisLabels"
            :key="i"
            :x="x(i)"
            :y="H - 12"
            text-anchor="middle"
            class="ui-chart__tick"
            :class="{ 'ui-chart__short': l.length > AXIS_MAX }"
            :data-axis="l.length > AXIS_MAX ? i : undefined"
          >
            {{ clip(l, AXIS_MAX) }}
          </text>
        </g>

        <template v-if="type === 'line' || type === 'area'">
          <g v-for="(s, i) in series" :key="s.name">
            <path v-if="type === 'area'" :d="area(s)" :fill="stroke(i)" fill-opacity="0.22" />
            <path
              :d="path(s)"
              fill="none"
              :stroke="stroke(i)"
              stroke-width="3"
              :stroke-dasharray="style(i).dash === 'none' ? undefined : style(i).dash"
            />
            <g
              v-for="(p, j) in s.points"
              :key="p.label"
              :transform="`translate(${x(j)} ${y(p.value)})`"
              :fill="stroke(i)"
            >
              <circle v-if="style(i).marker === 'circle'" r="5" />
              <rect v-else-if="style(i).marker === 'square'" x="-5" y="-5" width="10" height="10" />
              <path v-else-if="style(i).marker === 'triangle'" d="M0 -6 6 5H-6Z" />
              <path v-else-if="style(i).marker === 'diamond'" d="M0 -7 7 0 0 7-7 0Z" />
              <path
                v-else
                d="M-5 -5 5 5M5 -5-5 5"
                :stroke="stroke(i)"
                stroke-width="3"
                fill="none"
              />
            </g>
            <text
              :x="x(s.points.length - 1) + 10"
              :y="y(s.points.at(-1)?.value ?? 0) + 4"
              class="ui-chart__label"
              :fill="stroke(i)"
            >
              {{ clip(s.name, 14) }}
            </text>
          </g>
        </template>

        <template v-else-if="type === 'bar'">
          <g v-for="(s, i) in series" :key="s.name">
            <rect
              v-for="(p, j) in s.points"
              :key="p.label"
              :x="x(j) - (series.length * barW) / 2 + i * barW"
              :y="y(p.value)"
              :width="barW"
              :height="y(0) - y(p.value)"
              :fill="stroke(i)"
              :opacity="tip && tip.col !== null && tip.col !== j ? 0.55 : 1"
              rx="2"
            />
          </g>
          <text
            v-for="(s, i) in series"
            :key="s.name"
            :x="W - M.end + 10"
            :y="M.top + 14 + i * 18"
            class="ui-chart__label"
            :fill="stroke(i)"
          >
            {{ clip(s.name, 14) }}
          </text>
        </template>

        <template v-else-if="type === 'donut'">
          <circle
            :cx="D.cx"
            :cy="D.cy"
            :r="D.r"
            fill="none"
            stroke="var(--ui-color-border)"
            :stroke-width="D.w"
          />
          <g :transform="`rotate(-90 ${D.cx} ${D.cy})`">
            <circle
              v-for="sl in donut.slices"
              :key="sl.label"
              :cx="D.cx"
              :cy="D.cy"
              :r="D.r"
              fill="none"
              :stroke="stroke(sl.i)"
              :stroke-width="D.w"
              :stroke-dasharray="sl.dash"
              :stroke-dashoffset="sl.offset"
              class="ui-chart__hit"
              tabindex="0"
              role="img"
              :aria-label="`${sl.label}: ${n(sl.value)} (${sl.pct}%)`"
              :data-slice="sl.i"
            />
          </g>
          <text :x="D.cx" :y="D.cy + 6" text-anchor="middle" class="ui-chart__center">
            {{ centerText ?? donut.total.toLocaleString() }}
          </text>
          <g v-for="sl in donut.slices" :key="`l-${sl.label}`" :data-slice="sl.i">
            <rect
              :x="300"
              :y="M.top + 24 + sl.i * 44"
              width="20"
              height="20"
              :fill="stroke(sl.i)"
              rx="3"
            />
            <text
              :x="330"
              :y="M.top + 39 + sl.i * 44"
              class="ui-chart__label"
              fill="var(--ui-color-text-primary)"
            >
              {{ clip(sl.label, LEGEND_MAX) }}: {{ sl.value.toLocaleString() }} ({{ sl.pct }}%)
            </text>
          </g>
        </template>

        <template v-else>
          <g v-for="(f, i) in funnel" :key="f.label">
            <rect
              :x="M.start"
              :y="f.y"
              :width="(f.pct / 100) * funnelMax"
              :height="f.h"
              :fill="stroke(i)"
              rx="3"
              class="ui-chart__hit"
              tabindex="0"
              role="img"
              :aria-label="`${f.label}: ${n(f.value)} (${f.pct}%)`"
              :data-step="i"
            />
            <text
              :x="M.start + (f.pct / 100) * funnelMax + 10"
              :y="f.y + f.h / 2 + 4"
              class="ui-chart__label"
              fill="var(--ui-color-text-primary)"
            >
              {{ clip(f.label, LEGEND_MAX) }}: {{ f.value.toLocaleString() }} ({{ f.pct }}%)
            </text>
          </g>
        </template>

        <!-- One target per column over a line, area or bar chart: easy to point at, one tab stop each. -->
        <g v-if="columns">
          <rect
            v-for="(l, j) in labels"
            :key="`hit-${l}-${j}`"
            :x="x(j) - colW / 2"
            :y="M.top"
            :width="colW"
            :height="plotH"
            fill="transparent"
            class="ui-chart__hit"
            tabindex="0"
            role="img"
            :aria-label="columnLabel(j)"
            :data-col="j"
          />
        </g>
      </svg>

      <div v-if="tip" class="ui-chart__tip" :style="tipStyle" aria-hidden="true">
        <strong class="ui-text-label">{{ tip.title }}</strong>
        <span v-for="line in tip.lines" :key="line" class="ui-text-body-s">{{ line }}</span>
      </div>
    </div>

    <table v-show="showTable" class="ui-chart__table ui-text-body-s">
      <caption class="ui-sr-only">
        {{
          title
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">&nbsp;</th>
          <th v-for="s in series" :key="s.name" scope="col">{{ s.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in tableRows" :key="r.i">
          <th scope="row">{{ r.label }}</th>
          <td v-for="s in series" :key="s.name">{{ s.points[r.i]?.value.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
    <UiPagination
      v-if="showTable && paged"
      v-model:page="tablePage"
      :total="labels.length"
      :page-size="pageSize"
      :label="title"
    />
    <p class="ui-chart__summary ui-text-body-s">{{ summary }}</p>
  </figure>
</template>

<style scoped>
.ui-chart {
  margin: 0;
}
.ui-chart__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-2);
}
.ui-chart__head .ui-text-h3 {
  flex: 1;
}
.ui-chart__plot {
  position: relative;
}
.ui-chart__svg {
  inline-size: 100%;
  block-size: auto;
}
.ui-chart__tick {
  font-size: var(--ui-font-caption-size);
  fill: var(--ui-color-text-hint);
}
.ui-chart__short {
  cursor: help;
}
.ui-chart__hit {
  cursor: pointer;
}
.ui-chart__hit:focus-visible {
  outline: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}
.ui-chart__tip {
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  max-inline-size: 16rem;
  padding: var(--ui-space-2) var(--ui-space-3);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-elevation-2);
  pointer-events: none;
  overflow-wrap: anywhere;
}
.ui-chart__center {
  font-size: var(--ui-font-h2-size);
  font-weight: 700;
  fill: var(--ui-color-text-primary);
}
.ui-chart__label {
  font-size: var(--ui-font-body-s-size);
  font-weight: 600;
}
.ui-chart__table {
  inline-size: 100%;
  border-collapse: collapse;
}
.ui-chart__table th,
.ui-chart__table td {
  padding: var(--ui-space-2) var(--ui-space-3);
  text-align: start;
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-chart__summary {
  margin: var(--ui-space-2) 0 0;
  color: var(--ui-color-text-secondary);
}
</style>
