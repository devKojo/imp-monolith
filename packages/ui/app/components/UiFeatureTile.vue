<script setup lang="ts">
import type { IconName } from '../icons';
import UiCard from './UiCard.vue';
import UiIcon from './UiIcon.vue';

/** Icon, short title and one or two sentences: "how it works" and trust points. */
defineProps<{
  icon: IconName;
  title: string;
  description: string;
  headingLevel?: 2 | 3 | 4;
}>();
</script>

<template>
  <UiCard as="article">
    <div class="ui-tile__icon"><UiIcon :name="icon" :size="22" /></div>
    <component :is="`h${headingLevel ?? 3}`" class="ui-tile__title ui-text-h3">{{
      title
    }}</component>
    <p class="ui-tile__text ui-text-body-s">{{ description }}</p>
  </UiCard>
</template>

<style scoped>
.ui-tile__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--ui-space-10);
  block-size: var(--ui-space-10);
  margin-block-end: var(--ui-space-3);
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-radius: var(--ui-radius-md);
}
.ui-tile__title {
  margin: 0 0 var(--ui-space-1);
}
.ui-tile__text {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
</style>
