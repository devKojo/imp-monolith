<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';

/**
 * One reordering pattern for question lists, option lists and landing-page blocks (UI-A11Y-08,
 * UI-BLD-09). Move up / move down / remove are real buttons with item-specific names; drag and drop
 * may be layered on top as an enhancement but must never be the only way to reorder.
 */
const props = defineProps<{
  items: Array<{ id: string; label: string }>;
  /** Label for the list, e.g. "Quiz questions". */
  label: string;
  removable?: boolean;
}>();

const emit = defineEmits<{
  move: [payload: { id: string; from: number; to: number }];
  remove: [id: string];
}>();
const move = (from: number, to: number) => emit('move', { id: props.items[from]!.id, from, to });
</script>

<template>
  <ol class="ui-reorder" :aria-label="label">
    <li v-for="(item, i) in items" :key="item.id" class="ui-reorder__item">
      <div class="ui-reorder__content">
        <slot name="item" :item="item" :index="i">{{ item.label }}</slot>
      </div>
      <div class="ui-reorder__actions">
        <UiButton variant="secondary" icon="arrow-up" :disabled="i === 0" @click="move(i, i - 1)">
          <span class="ui-sr-only">{{ uiText('reorder.up', { item: item.label }) }}</span>
        </UiButton>
        <UiButton
          variant="secondary"
          icon="arrow-down"
          :disabled="i === items.length - 1"
          @click="move(i, i + 1)"
        >
          <span class="ui-sr-only">{{ uiText('reorder.down', { item: item.label }) }}</span>
        </UiButton>
        <UiButton v-if="removable" variant="tertiary" icon="trash" @click="emit('remove', item.id)">
          <span class="ui-sr-only">{{ uiText('reorder.remove', { item: item.label }) }}</span>
        </UiButton>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.ui-reorder {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-reorder__item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.ui-reorder__content {
  flex: 1;
  min-inline-size: 0;
}
.ui-reorder__actions {
  display: flex;
  gap: var(--ui-space-1);
}
</style>
