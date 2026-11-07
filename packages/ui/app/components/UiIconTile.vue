<script setup lang="ts">
import type { IconName } from '../icons';
import UiIcon from './UiIcon.vue';

/** A decorative icon in a tinted rounded square: the leading mark of stat, list and table rows. */
withDefaults(
  defineProps<{
    icon: IconName;
    tone?: 'brand' | 'success' | 'warning' | 'neutral';
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { tone: 'brand', size: 'md' },
);
</script>

<template>
  <span class="ui-icon-tile" :data-tone="tone" :data-size="size" aria-hidden="true">
    <UiIcon :name="icon" :size="size === 'lg' ? 24 : size === 'sm' ? 16 : 20" />
  </span>
</template>

<style scoped>
.ui-icon-tile {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: var(--ui-space-10);
  block-size: var(--ui-space-10);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
}
.ui-icon-tile[data-size='sm'] {
  inline-size: var(--ui-space-8);
  block-size: var(--ui-space-8);
}
.ui-icon-tile[data-size='lg'] {
  inline-size: var(--ui-space-12);
  block-size: var(--ui-space-12);
}
.ui-icon-tile[data-tone='success'] {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-text);
}
.ui-icon-tile[data-tone='warning'] {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-text);
}
.ui-icon-tile[data-tone='neutral'] {
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-secondary);
}
</style>
