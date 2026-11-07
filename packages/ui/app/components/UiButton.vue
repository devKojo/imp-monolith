<script setup lang="ts">
import { computed, useId } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
    size?: 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    /** Keeps width and announces busy; the label switches to `loadingLabel`. */
    loading?: boolean;
    loadingLabel?: string;
    disabled?: boolean;
    /** Why the button is disabled. Shown as text beside it, never only as a tooltip (spec 5). */
    disabledReason?: string;
    icon?: IconName;
    block?: boolean;
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
);

// Fall-through attributes (aria-expanded, data-*, class) belong on the <button>, not on the layout
// wrapper around it; otherwise ARIA attributes end up on a <span> where they are invalid.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{ click: [event: MouseEvent] }>();
const reasonId = useId();
const label = computed(() =>
  props.loading ? (props.loadingLabel ?? uiText('common.saving')) : undefined,
);

function onClick(e: MouseEvent) {
  if (props.loading || props.disabled) return e.preventDefault();
  emit('click', e);
}
</script>

<template>
  <span class="ui-button-wrap" :data-block="block">
    <button
      class="ui-button"
      :type="type"
      :data-variant="variant"
      :data-size="size"
      :disabled="disabled"
      :aria-busy="loading ? 'true' : undefined"
      :aria-disabled="loading ? 'true' : undefined"
      :aria-describedby="disabled && disabledReason ? reasonId : undefined"
      v-bind="$attrs"
      @click="onClick"
    >
      <UiIcon v-if="icon && !loading" :name="icon" :size="18" />
      <span class="ui-button__label">
        <template v-if="loading">{{ label }}</template>
        <slot v-else />
      </span>
    </button>
    <span
      v-if="disabled && disabledReason"
      :id="reasonId"
      class="ui-button__reason ui-text-body-s ui-text-hint"
    >
      {{ disabledReason }}
    </span>
  </span>
</template>

<style scoped>
.ui-button-wrap {
  display: inline-flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.ui-button-wrap[data-block='true'] {
  display: flex;
}
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  min-inline-size: var(--ui-control-target, var(--ui-target-public));
  padding-inline: var(--ui-space-4);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--ui-motion-fast) ease,
    border-color var(--ui-motion-fast) ease;
}
.ui-button[data-size='lg'] {
  padding-inline: var(--ui-space-6);
  font-size: var(--ui-font-body-l-size);
}
.ui-button-wrap[data-block='true'] .ui-button {
  inline-size: 100%;
}
.ui-button[data-variant='primary'] {
  background: var(--ui-color-action-primary);
  color: var(--ui-color-action-primary-text);
}
.ui-button[data-variant='secondary'] {
  background: var(--ui-color-surface);
  color: var(--ui-color-text-primary);
  border-color: var(--ui-color-border-strong);
}
.ui-button[data-variant='tertiary'] {
  background: transparent;
  color: var(--ui-color-link);
}
.ui-button[data-variant='danger'] {
  background: var(--ui-color-danger-text);
  color: var(--ui-color-action-primary-text);
}
.ui-button:hover:not(:disabled) {
  filter: brightness(0.94);
}
.ui-button:active:not(:disabled) {
  filter: brightness(0.88);
}
.ui-button:disabled {
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-hint);
  border-color: var(--ui-color-border);
  cursor: not-allowed;
}
.ui-button[aria-busy='true'] {
  cursor: progress;
}
</style>
