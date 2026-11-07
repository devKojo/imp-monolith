<script setup lang="ts">
import { computed } from 'vue';
import { statusVocabularies, type StatusDef, type StatusVocabulary } from '../status-vocabulary';
import UiIcon from './UiIcon.vue';

/** Status always combines icon, text and colour; never colour alone (UI-DSH-05). */
const props = defineProps<{
  vocabulary: StatusVocabulary;
  /** A key of the chosen vocabulary, e.g. "LIVE" for `campaign`. */
  status: string;
}>();

const def = computed<StatusDef | undefined>(
  () => (statusVocabularies[props.vocabulary] as Record<string, StatusDef>)[props.status],
);
</script>

<template>
  <span
    v-if="def"
    class="ui-chip ui-text-body-s"
    :data-tone="def.tone"
    :data-status="status"
    :title="def.meaning"
  >
    <UiIcon :name="def.icon" :size="14" />
    <span>{{ def.label }}</span>
  </span>
</template>

<style scoped>
.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-2);
  border: 1px solid currentcolor;
  border-radius: var(--ui-radius-pill);
  font-weight: 600;
  white-space: nowrap;
}
[data-tone='neutral'] {
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-secondary);
}
[data-tone='info'] {
  background: var(--ui-color-info-bg);
  color: var(--ui-color-info-text);
}
[data-tone='success'] {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-text);
}
[data-tone='warning'] {
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-text);
}
[data-tone='danger'] {
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-text);
}
/* Live pulses only when motion is allowed (global reduced-motion rule neutralises it). */
[data-status='LIVE'] :deep(svg) {
  animation: ui-pulse 1.6s ease-in-out infinite;
}
@keyframes ui-pulse {
  50% {
    opacity: 0.45;
  }
}
</style>
