<script setup lang="ts">
import { computed } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';

/**
 * Persistent conditions (spec 5): sits above content and pushes it down; stays until resolved or
 * dismissed where that is safe. Blocking errors use `error` (announced assertively); the others are
 * announced politely. Toasts are for transient success only.
 */
const props = withDefaults(
  defineProps<{
    tone?: 'info' | 'warning' | 'error' | 'system' | 'elevation';
    title?: string;
    dismissible?: boolean;
  }>(),
  { tone: 'info' },
);

const emit = defineEmits<{ dismiss: [] }>();
const icon = computed<IconName>(
  () =>
    ({
      info: 'info',
      warning: 'alert-triangle',
      error: 'alert-circle',
      system: 'info',
      elevation: 'lock',
    })[props.tone] as IconName,
);
const fallbackTitle = computed(() => uiText(`banner.${props.tone}` as const));
</script>

<template>
  <div class="ui-banner" :data-tone="tone" :role="tone === 'error' ? 'alert' : 'status'">
    <UiIcon :name="icon" :size="20" />
    <div class="ui-banner__body">
      <p v-if="title ?? fallbackTitle" class="ui-banner__title">{{ title ?? fallbackTitle }}</p>
      <div class="ui-banner__text"><slot /></div>
      <div v-if="$slots.actions" class="ui-banner__actions"><slot name="actions" /></div>
    </div>
    <UiButton v-if="dismissible" variant="tertiary" icon="x" @click="emit('dismiss')">
      <span class="ui-sr-only">{{ uiText('common.dismiss') }}</span>
    </UiButton>
  </div>
</template>

<style scoped>
.ui-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  border: 1px solid color-mix(in srgb, currentcolor 24%, transparent);
  border-radius: var(--ui-radius-lg);
}
.ui-banner__body {
  flex: 1;
  min-inline-size: 0;
}
.ui-banner__title {
  margin: 0;
  font-weight: 700;
}
.ui-banner__text {
  overflow-wrap: anywhere;
}
.ui-banner__actions {
  margin-block-start: var(--ui-space-2);
}
[data-tone='info'] {
  background: var(--ui-color-info-bg);
  color: var(--ui-color-info-text);
}
[data-tone='system'] {
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-secondary);
}
[data-tone='warning'],
[data-tone='elevation'] {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-text);
}
[data-tone='error'] {
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-text);
}
</style>
