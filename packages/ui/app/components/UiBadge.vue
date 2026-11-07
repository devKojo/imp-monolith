<script setup lang="ts">
import type { IconName } from '../icons';
import type { Tone } from '../status-vocabulary';
import UiIcon from './UiIcon.vue';

/**
 * The one small label/tag/pill. Status chips, experience-type tags, "time left" markers and
 * section pills are all badges; build them from this instead of restyling a span. Meaning is
 * never colour alone: pair the tone with an icon or explicit text.
 */
withDefaults(
  defineProps<{
    tone?: Tone;
    icon?: IconName;
    /** `rounded` (4 px, status badges) or `pill` (fully round, tags and counters). */
    shape?: 'rounded' | 'pill';
    /** Fill with the tone's background; `outline` keeps only the border. */
    variant?: 'soft' | 'outline';
  }>(),
  { tone: 'neutral', shape: 'rounded', variant: 'soft' },
);
</script>

<template>
  <span
    class="ui-badge ui-text-label-sm"
    :data-tone="tone"
    :data-shape="shape"
    :data-variant="variant"
  >
    <UiIcon v-if="icon" :name="icon" :size="14" />
    <span><slot /></span>
  </span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-2);
  border: 1px solid currentcolor;
  border-radius: var(--ui-radius-sm);
  white-space: nowrap;
}
.ui-badge[data-shape='pill'] {
  border-radius: var(--ui-radius-pill);
}
.ui-badge[data-variant='outline'] {
  background: transparent;
}
[data-tone='neutral'] {
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-secondary);
}
[data-tone='info'] {
  background: var(--ui-color-info-bg);
  color: var(--ui-color-info-text);
}
[data-tone='success'] {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-text);
}
[data-tone='warning'] {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-text);
}
[data-tone='danger'] {
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-text);
}
.ui-badge[data-variant='outline'] {
  background: transparent;
}
</style>
