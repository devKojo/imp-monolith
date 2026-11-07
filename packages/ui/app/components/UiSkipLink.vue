<script setup lang="ts">
import { uiText } from '../composables/useUiText';

/** First focusable element on every page (UI-A11Y-06). Targets the <main id="main"> landmark. */
withDefaults(defineProps<{ target?: string }>(), { target: '#main' });
</script>

<template>
  <a class="ui-skip" :href="target"
    ><slot>{{ uiText('common.skipToContent') }}</slot></a
  >
</template>

<style scoped>
.ui-skip {
  position: absolute;
  inset-block-start: var(--ui-space-2);
  inset-inline-start: var(--ui-space-2);
  z-index: 100;
  padding: var(--ui-space-2) var(--ui-space-4);
  background: var(--ui-color-surface);
  border: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  border-radius: var(--ui-radius-md);
  transform: translateY(-200%);
}
.ui-skip:focus {
  transform: none;
}
</style>
