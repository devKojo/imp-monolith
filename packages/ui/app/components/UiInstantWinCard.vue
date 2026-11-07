<script setup lang="ts">
import UiBadge from './UiBadge.vue';
import UiIcon from './UiIcon.vue';

/**
 * An instant-win entry: tag, reference, the odds in words, and a panel with one action (reveal).
 * The result is decided on the server; this card only presents and triggers (the action is a slot).
 */
defineProps<{
  tag: string;
  reference?: string;
  title: string;
  description: string;
  panelTitle: string;
  panelText?: string;
}>();
</script>

<template>
  <section class="ui-win" :aria-label="title">
    <div class="ui-win__top">
      <UiBadge tone="warning" icon="sparkles" shape="pill">{{ tag }}</UiBadge>
      <span v-if="reference" class="ui-win__ref ui-text-label-sm">{{ reference }}</span>
    </div>
    <h3 class="ui-win__title ui-text-h2">{{ title }}</h3>
    <p class="ui-win__desc ui-text-body-s">{{ description }}</p>
    <div class="ui-win__panel">
      <span class="ui-win__mark" aria-hidden="true"><UiIcon name="star" :size="22" /></span>
      <p class="ui-win__panel-title ui-text-label">{{ panelTitle }}</p>
      <p v-if="panelText" class="ui-win__panel-text ui-text-body-s">{{ panelText }}</p>
      <div class="ui-win__action"><slot name="action" /></div>
    </div>
  </section>
</template>

<style scoped>
.ui-win {
  display: flex;
  flex-direction: column;
  padding: var(--ui-space-6);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-elevation-1);
}
.ui-win__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-win__ref {
  color: var(--ui-color-text-hint);
}
.ui-win__title {
  margin: var(--ui-space-4) 0 0;
}
.ui-win__desc {
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-color-text-secondary);
}
.ui-win__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-block-start: var(--ui-space-5);
  padding: var(--ui-space-6);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  text-align: center;
}
.ui-win__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--ui-space-12);
  block-size: var(--ui-space-12);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-elevation-1);
  color: var(--ui-color-selected-text);
}
.ui-win__panel-title {
  margin: var(--ui-space-3) 0 0;
  font-weight: 600;
}
.ui-win__panel-text {
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-color-text-secondary);
}
.ui-win__action {
  inline-size: 100%;
  margin-block-start: var(--ui-space-4);
}
</style>
