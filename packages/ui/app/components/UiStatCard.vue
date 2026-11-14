<script setup lang="ts">
import type { IconName } from '../icons';
import type { Tone } from '../status-vocabulary';
import UiBadge from './UiBadge.vue';
import UiIconTile from './UiIconTile.vue';

/**
 * One headline number with its label, an optional trend/status badge and an icon, plus up to a few
 * "label / value" rows underneath. Used for dashboard KPIs. The value is real text (selectable,
 * readable by assistive tech); a change is stated in words by the badge, never by colour alone.
 */
withDefaults(
  defineProps<{
    label: string;
    value: string;
    /** Small text after the value ("tickets live", "of 8 total"). */
    suffix?: string;
    icon?: IconName;
    iconTone?: 'brand' | 'success' | 'warning' | 'neutral';
    badge?: string;
    badgeTone?: Tone;
    badgeIcon?: IconName;
    footer?: Array<{ label: string; value: string }>;
    /** `eyebrow` puts the label above in small caps; `plain` uses a normal label. */
    labelStyle?: 'eyebrow' | 'plain';
  }>(),
  { iconTone: 'brand', badgeTone: 'success', labelStyle: 'plain' },
);
</script>

<template>
  <article class="ui-stat" :data-label-style="labelStyle">
    <div class="ui-stat__top">
      <div class="ui-stat__main">
        <p
          class="ui-stat__label"
          :class="labelStyle === 'eyebrow' ? 'ui-text-label-sm' : 'ui-text-body-s'"
        >
          {{ label }}
        </p>
        <p class="ui-stat__value-row">
          <span class="ui-stat__value">{{ value }}</span>
          <span v-if="suffix" class="ui-stat__suffix ui-text-body-s">{{ suffix }}</span>
          <UiBadge v-if="badge" :tone="badgeTone" :icon="badgeIcon">{{ badge }}</UiBadge>
        </p>
      </div>
      <UiIconTile v-if="icon" :icon="icon" :tone="iconTone" />
    </div>
    <dl v-if="footer?.length" class="ui-stat__footer ui-text-body-s">
      <div v-for="row in footer" :key="row.label" class="ui-stat__row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <slot />
  </article>
</template>

<style scoped>
.ui-stat {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5) var(--ui-space-6);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.ui-stat__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-stat__label {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.ui-stat[data-label-style='eyebrow'] .ui-stat__label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.ui-stat__value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ui-space-2);
  margin: var(--ui-space-2) 0 0;
}
.ui-stat__value {
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ui-stat__suffix {
  color: var(--ui-color-text-secondary);
}
.ui-stat__footer {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding-block-start: var(--ui-space-4);
  border-block-start: 1px solid var(--ui-color-border);
  color: var(--ui-color-text-secondary);
}
.ui-stat__row {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-stat__row dt {
  margin: 0;
}
.ui-stat__row dd {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-weight: 500;
}
</style>
