<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { uiText } from '../composables/useUiText';
import { tokens } from '../tokens.generated';
import UiButton from './UiButton.vue';

export type ChartSeries = { name: string; points: Array<{ label: string; value: number }> };

/**
 * SVG chart (UI-A11Y-10, ADR-F008). Never colour alone: every series has its own marker and dash
 * pattern and a direct label at its end; bars use hatching patterns. Always paired with a text
 * summary and a data-table toggle. Approximate and provisional figures are labelled.
 */
const props = defineProps<{
  type: 'line' | 'bar' | 'funnel';
  title: string;
  series: ChartSeries[];
  /** Plain-language reading of the chart: required, shown under it. */
  summary: string;
  approx?: boolean;
  status?: 'provisional' | 'final';
}>();

const id = useId();
const showTable = ref(false);
const W = 600;
const H = 280;
const M = { top: 16, end: 96, bottom: 36, start: 48 };
const plotW = W - M.start - M.end;
const plotH = H - M.top - M.bottom;

const labels = computed(() => props.series[0]?.points.map((p) => p.label) ?? []);
const max = computed(() => {
  const m = Math.max(1, ...props.series.flatMap((s) => s.points.map((p) => p.value)));
  const pow = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / pow) * pow;
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
const statusText = computed(() =>
  props.status === 'provisional'
    ? uiText('chart.provisional')
    : props.status === 'final'
      ? uiText('chart.final')
      : '',
);
</script>

<template>
  <figure class="ui-chart">
    <figcaption class="ui-chart__head">
      <span class="ui-text-h3">{{ title }}</span>
      <span v-if="approx || statusText" class="ui-text-body-s ui-text-hint">{{
        [approx ? uiText('chart.approx') : '', statusText].filter(Boolean).join(' · ')
      }}</span>
      <UiButton variant="tertiary" @click="showTable = !showTable">{{
        showTable ? uiText('chart.showChart') : uiText('chart.showTable')
      }}</UiButton>
    </figcaption>

    <svg
      v-show="!showTable"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`${title}. ${summary}`"
      class="ui-chart__svg"
    >
      <defs>
        <pattern
          v-for="(s, i) in series"
          :id="`${id}-p${i}`"
          :key="s.name"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          :patternTransform="`rotate(${i * 35})`"
        >
          <rect width="8" height="8" fill="var(--ui-color-surface)" />
          <rect :width="2 + (i % 3)" height="8" :fill="stroke(i)" />
        </pattern>
      </defs>
      <g v-if="type !== 'funnel'">
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
        <text
          v-for="(l, i) in labels"
          :key="l"
          :x="x(i)"
          :y="H - 12"
          text-anchor="middle"
          class="ui-chart__tick"
        >
          {{ l }}
        </text>
      </g>

      <template v-if="type === 'line'">
        <g v-for="(s, i) in series" :key="s.name">
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
            <path v-else d="M-5 -5 5 5M5 -5-5 5" :stroke="stroke(i)" stroke-width="3" fill="none" />
          </g>
          <text
            :x="x(s.points.length - 1) + 10"
            :y="y(s.points.at(-1)?.value ?? 0) + 4"
            class="ui-chart__label"
            :fill="stroke(i)"
          >
            {{ s.name }}
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
            :fill="`url(#${id}-p${i})`"
            :stroke="stroke(i)"
            stroke-width="2"
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
          {{ s.name }}
        </text>
      </template>

      <template v-else>
        <g v-for="(f, i) in funnel" :key="f.label">
          <rect
            :x="M.start"
            :y="f.y"
            :width="(f.pct / 100) * (plotW + 40)"
            :height="f.h"
            :fill="`url(#${id}-p${i % 5})`"
            :stroke="stroke(i)"
            stroke-width="2"
          />
          <text
            :x="M.start + 6"
            :y="f.y + f.h / 2 + 4"
            class="ui-chart__label"
            fill="var(--ui-color-text-primary)"
          >
            {{ f.label }}: {{ f.value.toLocaleString() }} ({{ f.pct }}%)
          </text>
        </g>
      </template>
    </svg>

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
        <tr v-for="(l, i) in labels" :key="l">
          <th scope="row">{{ l }}</th>
          <td v-for="s in series" :key="s.name">{{ s.points[i]?.value.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
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
.ui-chart__svg {
  inline-size: 100%;
  block-size: auto;
}
.ui-chart__tick {
  font-size: var(--ui-font-caption-size);
  fill: var(--ui-color-text-hint);
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
