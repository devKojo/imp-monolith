<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: 'div' | 'section' | 'article';
    /** Card heading (h3 by default; match the page outline with `headingLevel`). */
    title?: string;
    headingLevel?: 2 | 3 | 4;
    tone?: 'default' | 'subtle';
    /** Raised cards always keep their border so edges stay visible (spec 3.4). */
    raised?: boolean;
  }>(),
  { as: 'div', headingLevel: 3, tone: 'default' },
);
</script>

<template>
  <component :is="as" class="ui-card" :data-tone="tone" :data-raised="raised">
    <component :is="`h${headingLevel}`" v-if="title" class="ui-card__title ui-text-h3">{{
      title
    }}</component>
    <slot />
  </component>
</template>

<style scoped>
.ui-card {
  padding: var(--ui-space-5);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-elevation-1);
}
.ui-card[data-tone='subtle'] {
  background: var(--ui-color-surface-subtle);
  box-shadow: none;
}
.ui-card[data-raised='true'] {
  box-shadow: var(--ui-elevation-2);
}
.ui-card__title {
  margin: 0 0 var(--ui-space-3);
}
</style>
