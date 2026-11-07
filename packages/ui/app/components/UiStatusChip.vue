<script setup lang="ts">
import { computed } from 'vue';
import { statusVocabularies, type StatusDef, type StatusVocabulary } from '../status-vocabulary';
import UiBadge from './UiBadge.vue';

/**
 * Status always combines icon, text and colour; never colour alone (UI-DSH-05). It is a UiBadge
 * driven by a fixed vocabulary, so every status looks the same wherever it appears.
 */
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
  <UiBadge
    v-if="def"
    :tone="def.tone"
    :icon="def.icon"
    shape="pill"
    :data-status="status"
    :title="def.meaning"
  >
    {{ def.label }}
  </UiBadge>
</template>

<style scoped>
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
