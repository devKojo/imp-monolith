<script setup lang="ts">
import type { IconName } from '../icons';
import UiIcon from './UiIcon.vue';

/**
 * Always says why it is empty and what to do next (spec 5). Reused for "no data yet", "no filter
 * results" and, through UiSystemState, every page-level terminal state.
 */
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    icon?: IconName;
    /** Heading level so the page outline stays correct. */
    headingLevel?: 1 | 2 | 3;
  }>(),
  { headingLevel: 2 },
);
</script>

<template>
  <section class="ui-empty">
    <UiIcon v-if="icon" :name="icon" :size="32" />
    <component :is="`h${headingLevel}`" class="ui-empty__title ui-text-h2">{{ title }}</component>
    <p v-if="description" class="ui-empty__body ui-text-body">{{ description }}</p>
    <div v-if="$slots.default" class="ui-empty__actions"><slot /></div>
  </section>
</template>

<style scoped>
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-10) var(--ui-space-4);
  text-align: center;
  color: var(--ui-color-text-secondary);
}
.ui-empty__title {
  margin: 0;
  color: var(--ui-color-text-primary);
}
.ui-empty__body {
  max-inline-size: var(--ui-layout-reading-column);
  margin: 0;
}
.ui-empty__actions {
  margin-block-start: var(--ui-space-3);
}
</style>
