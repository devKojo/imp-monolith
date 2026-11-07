<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiLiveRegion from './UiLiveRegion.vue';
import UiProgress from './UiProgress.vue';

/**
 * Campaign countdown and quiz timer (spec 5, UI-A11Y-07). A visual timer plus text; the screen
 * reader hears only the 50%, 20% and 10% marks, never every second; an extension control is
 * available without asking for a reason. The parent owns the (server-authoritative) clock.
 */
const props = defineProps<{
  secondsRemaining: number;
  totalSeconds: number;
  label: string;
  extendable?: boolean;
}>();
const emit = defineEmits<{ extend: [] }>();

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;
const pct = computed(() =>
  Math.max(0, Math.min(100, (props.secondsRemaining / props.totalSeconds) * 100)),
);
const tone = computed(() => (pct.value <= 20 ? 'danger' : pct.value <= 50 ? 'warning' : 'brand'));

const announced = new Set<number>();
const message = ref('');
watch(pct, (now) => {
  for (const mark of [50, 20, 10]) {
    if (now <= mark && !announced.has(mark)) {
      announced.add(mark);
      message.value = uiText('countdown.remaining', { time: mmss(props.secondsRemaining) });
    }
  }
});
</script>

<template>
  <div class="ui-countdown">
    <div class="ui-countdown__row">
      <span class="ui-text-body-s">{{ label }}</span>
      <strong class="ui-countdown__time" aria-hidden="true">{{
        uiText('countdown.remaining', { time: mmss(secondsRemaining) })
      }}</strong>
    </div>
    <UiProgress :value="pct" :label="label" :tone="tone" />
    <UiButton v-if="extendable" variant="secondary" @click="emit('extend')">{{
      uiText('countdown.extend')
    }}</UiButton>
    <UiLiveRegion :message="message" />
  </div>
</template>

<style scoped>
.ui-countdown {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.ui-countdown__row {
  display: flex;
  justify-content: space-between;
}
.ui-countdown__time {
  font-variant-numeric: tabular-nums;
}
</style>
