<script setup lang="ts">
import { uiText } from '../composables/useUiText';

/**
 * Placeholder for a known layout (spec 11): replaced by real content without layout shift, so give
 * it the final dimensions via `lines`/`rows`. Use a spinner-style busy button only for actions of
 * unknown duration.
 */
withDefaults(
  defineProps<{
    variant?: 'text' | 'card' | 'table' | 'chart' | 'form';
    lines?: number;
    rows?: number;
  }>(),
  { variant: 'text', lines: 3, rows: 5 },
);
</script>

<template>
  <div class="ui-skeleton" :data-variant="variant" aria-busy="true">
    <span class="ui-sr-only" role="status">{{ uiText('common.loading') }}</span>
    <div aria-hidden="true" class="ui-skeleton__shape">
      <template v-if="variant === 'text'">
        <span v-for="n in lines" :key="n" class="ui-skeleton__bar" />
      </template>
      <template v-else-if="variant === 'card'">
        <span class="ui-skeleton__block" />
        <span class="ui-skeleton__bar" />
        <span class="ui-skeleton__bar" />
      </template>
      <template v-else-if="variant === 'table'">
        <span v-for="n in rows" :key="n" class="ui-skeleton__row"
          ><span class="ui-skeleton__bar" /><span class="ui-skeleton__bar" /><span
            class="ui-skeleton__bar"
        /></span>
      </template>
      <template v-else-if="variant === 'chart'">
        <span class="ui-skeleton__block ui-skeleton__block--tall" />
      </template>
      <template v-else>
        <span v-for="n in 3" :key="n" class="ui-skeleton__field"
          ><span class="ui-skeleton__bar ui-skeleton__bar--short" /><span
            class="ui-skeleton__block"
        /></span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ui-skeleton__shape {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.ui-skeleton__bar,
.ui-skeleton__block {
  display: block;
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-sm);
  animation: ui-skeleton-pulse 1.4s ease-in-out infinite alternate;
}
.ui-skeleton__bar {
  block-size: var(--ui-space-4);
}
.ui-skeleton__bar--short {
  inline-size: 40%;
}
.ui-skeleton__block {
  block-size: var(--ui-space-12);
}
.ui-skeleton__block--tall {
  block-size: calc(var(--ui-space-12) * 5);
}
.ui-skeleton__row,
.ui-skeleton__field {
  display: grid;
  gap: var(--ui-space-3);
}
.ui-skeleton__row {
  grid-template-columns: 2fr 1fr 1fr;
}
@keyframes ui-skeleton-pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}
</style>
