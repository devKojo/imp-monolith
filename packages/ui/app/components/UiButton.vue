<script setup lang="ts">
import { computed, useId } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';

/**
 * One button for every action, including navigation: pass `to` to render a link with identical
 * styling (call-to-action links are buttons visually but anchors semantically).
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
    size?: 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    /** Render as a link to this route or URL instead of a <button>. */
    to?: string;
    /** Keeps width and announces busy; the label switches to `loadingLabel`. */
    loading?: boolean;
    loadingLabel?: string;
    disabled?: boolean;
    /** Why the button is disabled. Shown as text beside it, never only as a tooltip (spec 5). */
    disabledReason?: string;
    icon?: IconName;
    /** Icon after the label (for example an arrow on a forward action). */
    iconTrailing?: IconName;
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

const element = computed(() => (props.to ? UiLink : 'button'));
const elementProps = computed(() =>
  props.to
    ? { to: props.to, bare: true }
    : {
        type: props.type,
        disabled: props.disabled,
        'aria-busy': props.loading ? 'true' : undefined,
        'aria-disabled': props.loading ? 'true' : undefined,
        'aria-describedby': props.disabled && props.disabledReason ? reasonId : undefined,
      },
);

function onClick(e: MouseEvent) {
  if (props.loading || props.disabled) return e.preventDefault();
  emit('click', e);
}
</script>

<template>
  <span class="ui-button-wrap" :data-block="block">
    <component
      :is="element"
      v-bind="{ ...elementProps, ...$attrs }"
      class="ui-button"
      :data-variant="variant"
      :data-size="size"
      @click="onClick"
    >
      <UiIcon v-if="loading" name="loader" :size="18" class="ui-button__spinner" />
      <UiIcon v-else-if="icon" :name="icon" :size="18" />
      <span class="ui-button__label">
        <template v-if="loading">{{ label }}</template>
        <slot v-else />
      </span>
      <UiIcon v-if="iconTrailing && !loading" :name="iconTrailing" :size="18" />
    </component>
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
    border-color var(--ui-motion-fast) ease,
    box-shadow var(--ui-motion-fast) ease,
    transform var(--ui-motion-fast) ease;
}
.ui-button:active:not(:disabled) {
  transform: translateY(1px);
}
.ui-button[data-size='lg'] {
  padding-inline: var(--ui-space-6);
  font-size: var(--ui-font-body-l-size);
}
.ui-button-wrap[data-block='true'] .ui-button {
  inline-size: 100%;
}

/* Interaction states come from tokens (design reference: Components > Buttons). */
.ui-button[data-variant='primary'] {
  background: var(--ui-color-action-primary);
  color: var(--ui-color-action-primary-text);
  box-shadow: var(--ui-elevation-1);
}
.ui-button[data-variant='primary']:hover:not(:disabled) {
  background: var(--ui-color-action-primary-hover);
  box-shadow: var(--ui-elevation-2);
}
.ui-button[data-variant='primary']:active:not(:disabled) {
  background: var(--ui-color-action-primary-active);
}
.ui-button[data-variant='secondary'] {
  background: var(--ui-color-surface);
  color: var(--ui-color-text-secondary);
  border-color: var(--ui-color-border-strong);
}
.ui-button[data-variant='secondary']:hover:not(:disabled) {
  background: var(--ui-color-surface-hover);
  color: var(--ui-color-text-primary);
}
.ui-button[data-variant='secondary']:active:not(:disabled) {
  background: var(--ui-color-surface-pressed);
}
.ui-button[data-variant='tertiary'] {
  background: transparent;
  color: var(--ui-color-link);
}
.ui-button[data-variant='tertiary']:hover:not(:disabled) {
  background: var(--ui-color-selected-bg);
}
.ui-button[data-variant='danger'] {
  background: var(--ui-color-danger-action);
  color: var(--ui-color-action-primary-text);
}
.ui-button[data-variant='danger']:hover:not(:disabled) {
  background: var(--ui-color-danger-action-hover);
}
.ui-button[data-variant='danger']:active:not(:disabled) {
  background: var(--ui-color-danger-action-active);
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
.ui-button__spinner {
  animation: ui-spin 0.9s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
