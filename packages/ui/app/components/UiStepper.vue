<script setup lang="ts">
import { computed } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiProgress from './UiProgress.vue';

export type StepStatus = 'notStarted' | 'inProgress' | 'complete' | 'issues';
export type Step = { id: string; label: string; status?: StepStatus };

/**
 * Builder stages and participant multi-step flows (spec 5, UI-BLD-01, UI-PUB-05). "Step n of N" is
 * always text, with a bar. In `builder` mode stages are non-linear and each shows its status as
 * icon + text; in `flow` mode it is the compact participant header.
 */
const props = withDefaults(
  defineProps<{ steps: Step[]; current: string; mode?: 'builder' | 'flow' }>(),
  { mode: 'flow' },
);
const emit = defineEmits<{ select: [id: string] }>();

const index = computed(() =>
  Math.max(
    0,
    props.steps.findIndex((s) => s.id === props.current),
  ),
);
const pct = computed(() => Math.round(((index.value + 1) / props.steps.length) * 100));
const statusIcon: Record<StepStatus, IconName> = {
  notStarted: 'minus',
  inProgress: 'pencil',
  complete: 'check-circle',
  issues: 'alert-triangle',
};
const statusText = (s?: StepStatus) => uiText(`stepper.status.${s ?? 'notStarted'}` as const);
</script>

<template>
  <nav
    class="ui-stepper"
    :aria-label="uiText('stepper.step', { n: index + 1, total: steps.length })"
  >
    <p class="ui-stepper__count ui-text-body-s">
      {{ uiText('stepper.step', { n: index + 1, total: steps.length }) }}
    </p>
    <UiProgress
      :value="pct"
      :label="uiText('stepper.step', { n: index + 1, total: steps.length })"
    />
    <ol v-if="mode === 'builder'" class="ui-stepper__list">
      <li v-for="(s, i) in steps" :key="s.id">
        <button
          type="button"
          class="ui-stepper__item"
          :aria-current="s.id === current ? 'step' : undefined"
          @click="emit('select', s.id)"
        >
          <span class="ui-stepper__num">{{ i + 1 }}</span>
          <span class="ui-stepper__label">{{ s.label }}</span>
          <span class="ui-stepper__status ui-text-body-s" :data-status="s.status ?? 'notStarted'">
            <UiIcon :name="statusIcon[s.status ?? 'notStarted']" :size="14" />
            {{ statusText(s.status) }}
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.ui-stepper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.ui-stepper__count {
  margin: 0;
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
.ui-stepper__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: var(--ui-space-2) 0 0;
  padding: 0;
  list-style: none;
}
.ui-stepper__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 var(--ui-space-2);
  inline-size: 100%;
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: var(--ui-space-2) var(--ui-space-3);
  background: transparent;
  color: var(--ui-color-text-primary);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.ui-stepper__item[aria-current='step'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
}
.ui-stepper__num {
  grid-row: span 2;
  align-self: center;
  font-weight: 700;
}
.ui-stepper__status {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  grid-column: 2;
  color: var(--ui-color-text-secondary);
}
.ui-stepper__status[data-status='issues'] {
  color: var(--ui-color-warning-text);
}
.ui-stepper__status[data-status='complete'] {
  color: var(--ui-color-success-text);
}
</style>
