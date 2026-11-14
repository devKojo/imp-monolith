<script setup lang="ts">
import type { IconName } from '../icons';
import UiIcon from './UiIcon.vue';

/**
 * Single-select filter chips (campaign type, status, date range). Toggle buttons with
 * aria-pressed, so the choice is announced as a state and never colour alone: the selected chip
 * also gets a heavier border and a check. Chips wrap, so no horizontal scrolling is needed.
 */
defineProps<{
  modelValue: string;
  /** Accessible name of the group, e.g. "Campaign type". */
  label: string;
  options: Array<{ value: string; label: string; icon?: IconName }>;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div role="group" :aria-label="label" class="ui-chips">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="ui-chip ui-text-label"
      :aria-pressed="modelValue === o.value"
      @click="emit('update:modelValue', o.value)"
    >
      <UiIcon v-if="modelValue === o.value" name="check" :size="14" />
      <UiIcon v-else-if="o.icon" :name="o.icon" :size="14" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.ui-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-secondary);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-pill);
  font: inherit;
  font-size: var(--ui-font-caption-size);
  line-height: var(--ui-font-caption-line);
  cursor: pointer;
}
.ui-chip:hover {
  background: var(--ui-color-surface-hover);
  color: var(--ui-color-text-primary);
}
.ui-chip[aria-pressed='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
  font-weight: 600;
}
</style>
