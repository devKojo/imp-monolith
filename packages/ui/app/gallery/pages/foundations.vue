<script setup lang="ts">
import tokenSource from '../../../tokens/tokens.json';
import { contrastRatio } from '../../../scripts/lib/contrast';
import UiButton from '../../components/UiButton.vue';
import GalleryFrame from '../GalleryFrame.vue';

useHead({ title: 'Foundations - UI workbench' });

const raw = tokenSource.raw as Record<string, string>;
const semantic = Object.entries(tokenSource.semantic as Record<string, string>).map(
  ([name, rawName]) => ({ name, hex: raw[rawName]!, rawName }),
);
const pairs = tokenSource.contrast.map((p) => {
  const hex = (n: string) => raw[(tokenSource.semantic as Record<string, string>)[n] ?? n]!;
  const ratio = contrastRatio(hex(p.fg), hex(p.bg));
  const waived = 'waiver' in p && ratio < p.min;
  return { ...p, fgHex: hex(p.fg), bgHex: hex(p.bg), ratio, ok: ratio >= p.min, waived };
});
const styles = Object.entries(tokenSource.font.styles);
const space = Object.entries(tokenSource.space);
const radius = Object.entries(tokenSource.radius);
const elevation = Object.keys(tokenSource.elevation);
const markers = tokenSource.chartSeries;
</script>

<template>
  <GalleryFrame title="Foundations" current="/ui/foundations">
    <p class="ui-text-body">
      Source: <code>packages/ui/tokens/tokens.json</code>. Components use
      <strong>semantic</strong> tokens only; raw values are never referenced directly.
    </p>

    <h2 class="ui-text-h2">Colour (semantic tokens)</h2>
    <ul class="swatches">
      <li v-for="c in semantic" :key="c.name">
        <span class="swatch" :style="{ background: `var(--ui-color-${c.name})` }" />
        <span
          ><code>--ui-color-{{ c.name }}</code
          ><br /><span class="ui-text-caption ui-text-hint"
            >{{ c.hex }} ({{ c.rawName }})</span
          ></span
        >
      </li>
    </ul>

    <h2 class="ui-text-h2">Contrast (checked on every build)</h2>
    <div class="scroll" role="region" tabindex="0" aria-label="Contrast table">
      <table class="ui-text-body-s">
        <thead>
          <tr>
            <th scope="col">Sample</th>
            <th scope="col">Pair</th>
            <th scope="col">Use</th>
            <th scope="col">Ratio</th>
            <th scope="col">Required</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pairs" :key="p.fg + p.bg + p.use">
            <td>
              <span
                class="sample"
                :style="{
                  color: `var(--ui-color-${p.fg}, var(--ui-raw-${p.fg}))`,
                  background: `var(--ui-color-${p.bg}, var(--ui-raw-${p.bg}))`,
                }"
                >Aa</span
              >
            </td>
            <td>{{ p.fg }} on {{ p.bg }}</td>
            <td>{{ p.use }}</td>
            <td>{{ p.ratio.toFixed(2) }}:1</td>
            <td>{{ p.min }}:1</td>
            <td>{{ p.ok ? 'Pass' : p.waived ? 'Waived (see ADR-F004)' : 'FAIL' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="ui-text-h2">Chart series (marker + dash, never colour alone)</h2>
    <ul class="series">
      <li v-for="(s, i) in markers" :key="s.token">
        <svg
          width="120"
          height="24"
          viewBox="0 0 120 24"
          role="img"
          :aria-label="`${s.name}: ${s.marker} marker, ${s.dash === 'none' ? 'solid' : 'dashed'} line`"
        >
          <line
            x1="4"
            x2="116"
            y1="12"
            y2="12"
            :stroke="`var(--ui-chart-${i + 1})`"
            stroke-width="3"
            :stroke-dasharray="s.dash === 'none' ? undefined : s.dash"
          />
          <circle
            v-if="s.marker === 'circle'"
            cx="60"
            cy="12"
            r="5"
            :fill="`var(--ui-chart-${i + 1})`"
          />
          <rect
            v-else-if="s.marker === 'square'"
            x="55"
            y="7"
            width="10"
            height="10"
            :fill="`var(--ui-chart-${i + 1})`"
          />
          <path
            v-else-if="s.marker === 'triangle'"
            d="M60 6 66 17H54Z"
            :fill="`var(--ui-chart-${i + 1})`"
          />
          <path
            v-else-if="s.marker === 'diamond'"
            d="M60 5 67 12 60 19 53 12Z"
            :fill="`var(--ui-chart-${i + 1})`"
          />
          <path
            v-else
            d="M55 7 65 17M65 7 55 17"
            :stroke="`var(--ui-chart-${i + 1})`"
            stroke-width="3"
          />
        </svg>
        <span class="ui-text-body-s"
          >{{ s.name }} · {{ s.marker }} ·
          {{ s.dash === 'none' ? 'solid' : `dash ${s.dash}` }}</span
        >
      </li>
    </ul>

    <h2 class="ui-text-h2">Typography</h2>
    <ul class="type">
      <li
        v-for="[name, s] in styles"
        :key="name"
        :style="{
          fontSize: `var(--ui-font-${name}-size)`,
          lineHeight: `var(--ui-font-${name}-line)`,
          fontWeight: `var(--ui-font-${name}-weight)`,
        }"
      >
        {{ name }} - {{ s.size }}/{{ s.line }} · {{ s.weight }} - The quick brown fox jumps
      </li>
    </ul>

    <h2 class="ui-text-h2">Spacing and radius</h2>
    <ul class="space">
      <li v-for="[k, v] in space" :key="k">
        <span class="bar" :style="{ inlineSize: `var(--ui-space-${k})` }" />
        <code>--ui-space-{{ k }}</code> {{ v }} px
      </li>
    </ul>
    <ul class="radii">
      <li v-for="[k, v] in radius" :key="k">
        <span class="box" :style="{ borderRadius: `var(--ui-radius-${k})` }" /> <code>{{ k }}</code>
        {{ v }} px
      </li>
      <li v-for="k in elevation" :key="k">
        <span class="box" :style="{ boxShadow: `var(--ui-elevation-${k})` }" />
        <code>elevation-{{ k }}</code>
      </li>
    </ul>

    <h2 class="ui-text-h2">Focus ring and targets</h2>
    <p class="ui-text-body">
      Tab to any control: a 2 px ring with 2 px offset (3:1). Targets are 44 px on public pages and
      32 px in the dashboard.
    </p>
    <div class="row">
      <UiButton>Focus me (44 px)</UiButton>
      <div style="--ui-control-target: var(--ui-target-dashboard)">
        <UiButton variant="secondary">Dashboard size (32 px)</UiButton>
      </div>
    </div>
  </GalleryFrame>
</template>

<style scoped>
.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-3);
  padding: 0;
  list-style: none;
}
.swatches li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}
.swatch {
  flex: none;
  inline-size: var(--ui-space-10);
  block-size: var(--ui-space-10);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-sm);
}
.scroll {
  overflow: auto;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
table {
  inline-size: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--ui-space-2) var(--ui-space-3);
  text-align: start;
  border-block-end: 1px solid var(--ui-color-border);
}
.sample {
  display: inline-block;
  padding: var(--ui-space-1) var(--ui-space-3);
  border: 1px solid var(--ui-color-border);
  font-weight: 700;
}
.series,
.type,
.space,
.radii {
  padding: 0;
  list-style: none;
}
.series li,
.space li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  margin-block: var(--ui-space-1);
}
.type li {
  margin-block: var(--ui-space-2);
}
.bar {
  display: inline-block;
  block-size: var(--ui-space-3);
  background: var(--ui-color-action-primary);
}
.radii {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-5);
}
.radii li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2);
}
.box {
  display: block;
  inline-size: var(--ui-space-12);
  block-size: var(--ui-space-12);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-4);
}
</style>
