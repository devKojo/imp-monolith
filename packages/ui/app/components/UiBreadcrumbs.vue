<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';

/** The current page is the last item and carries aria-current="page" (spec 5, navigation). */
defineProps<{ items: Array<{ label: string; to?: string }> }>();
</script>

<template>
  <nav :aria-label="uiText('nav.breadcrumb')" class="ui-crumbs ui-text-body-s">
    <ol>
      <li v-for="(item, i) in items" :key="item.label">
        <UiLink v-if="item.to && i < items.length - 1" :to="item.to">{{ item.label }}</UiLink>
        <span v-else aria-current="page">{{ item.label }}</span>
        <UiIcon v-if="i < items.length - 1" name="chevron-right" :size="14" />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  color: var(--ui-color-text-secondary);
}
</style>
