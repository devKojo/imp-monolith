<script setup lang="ts">
/**
 * Visual separator, optionally with a centred word ("or"). Use it between alternative ways to do
 * the same thing; for unrelated sections use headings and spacing instead.
 */
defineProps<{ label?: string }>();
</script>

<template>
  <div class="ui-divider" role="separator" :data-labelled="!!label">
    <span v-if="label" class="ui-divider__label ui-text-label-sm">{{ label }}</span>
  </div>
</template>

<style scoped>
.ui-divider {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  color: var(--ui-color-text-secondary);
}
.ui-divider::before,
.ui-divider::after {
  content: '';
  flex: 1;
  block-size: 1px;
  background: var(--ui-color-border);
}
.ui-divider[data-labelled='false']::after {
  display: none;
}
.ui-divider__label {
  text-transform: uppercase;
}
</style>
