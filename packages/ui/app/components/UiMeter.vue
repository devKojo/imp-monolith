<script setup lang="ts">
import { computed } from 'vue';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiProgress from './UiProgress.vue';

/**
 * Usage and spend-cap meter (UI-DSH-12). Tone and an icon + text change at 80% and 100%, so the
 * warning is never colour alone. Pair it with a banner at those thresholds.
 */
const props = defineProps<{ label: string; used: number; limit: number; unit?: string }>();

const pct = computed(() => (props.limit > 0 ? Math.round((props.used / props.limit) * 100) : 0));
const level = computed(() => (pct.value >= 100 ? 'full' : pct.value >= 80 ? 'near' : 'ok'));
const tone = computed(
  () =>
    ({ ok: 'brand', near: 'warning', full: 'danger' })[level.value] as
      'brand' | 'warning' | 'danger',
);
const note = computed(
  () => ({ ok: '', near: uiText('meter.near'), full: uiText('meter.full') })[level.value],
);
</script>

<template>
  <div class="ui-meter" :data-level="level">
    <div class="ui-meter__head ui-text-body-s">
      <span>{{ label }}</span>
      <span>{{
        uiText('meter.of', {
          used: used.toLocaleString(),
          limit: limit.toLocaleString(),
          unit: unit ? ` ${unit}` : '',
          pct,
        })
      }}</span>
    </div>
    <UiProgress :value="pct" :label="label" :tone="tone" />
    <p v-if="note" class="ui-meter__note ui-text-body-s">
      <UiIcon :name="level === 'full' ? 'alert-circle' : 'alert-triangle'" :size="14" /> {{ note }}
    </p>
  </div>
</template>

<style scoped>
.ui-meter {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.ui-meter__head {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-2);
  color: var(--ui-color-text-secondary);
}
.ui-meter__note {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  margin: 0;
}
[data-level='near'] .ui-meter__note {
  color: var(--ui-color-warning-text);
}
[data-level='full'] .ui-meter__note {
  color: var(--ui-color-danger-text);
}
</style>
