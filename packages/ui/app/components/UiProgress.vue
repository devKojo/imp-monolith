<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 0 to 100. Omit for an indeterminate bar. */
    value?: number;
    /** Accessible name; the visible text value belongs next to the bar (colour is never alone). */
    label: string;
    tone?: 'brand' | 'success' | 'warning' | 'danger';
  }>(),
  { tone: 'brand' },
);

const pct = computed(() =>
  props.value === undefined ? undefined : Math.min(100, Math.max(0, props.value)),
);
</script>

<template>
  <div
    class="ui-progress"
    :data-tone="tone"
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="pct"
  >
    <div
      class="ui-progress__bar"
      :data-indeterminate="pct === undefined"
      :style="{ inlineSize: `${pct ?? 40}%` }"
    />
  </div>
</template>

<style scoped>
.ui-progress {
  block-size: var(--ui-space-2);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-pill);
  overflow: hidden;
}
.ui-progress__bar {
  block-size: 100%;
  background: var(--ui-color-action-primary);
  transition: inline-size var(--ui-motion-base) ease;
}
[data-tone='success'] .ui-progress__bar {
  background: var(--ui-color-success-text);
}
[data-tone='warning'] .ui-progress__bar {
  background: var(--ui-color-warning-text);
}
[data-tone='danger'] .ui-progress__bar {
  background: var(--ui-color-danger-text);
}
.ui-progress__bar[data-indeterminate='true'] {
  animation: ui-progress-slide 1.2s ease-in-out infinite alternate;
}
@keyframes ui-progress-slide {
  from {
    margin-inline-start: 0;
  }
  to {
    margin-inline-start: 60%;
  }
}
</style>
