<script setup lang="ts">
import { useId } from 'vue';
import { uiText } from '../composables/useUiText';

/** Only for settings that take effect immediately. State is shown as text, not colour alone. */
const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const labelId = useId();
</script>

<template>
  <div class="ui-switch">
    <span :id="labelId">{{ label }}</span>
    <button
      type="button"
      role="switch"
      class="ui-switch__control"
      :aria-checked="modelValue"
      :aria-labelledby="labelId"
      :disabled="disabled"
      @click="emit('update:modelValue', !props.modelValue)"
    >
      <span class="ui-switch__thumb" />
      <span class="ui-switch__state ui-text-body-s">{{
        modelValue ? uiText('common.on') : uiText('common.off')
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.ui-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.ui-switch__control {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-primary);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-pill);
  cursor: pointer;
}
.ui-switch__thumb {
  inline-size: var(--ui-space-4);
  block-size: var(--ui-space-4);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-border-strong);
}
.ui-switch__control[aria-checked='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
}
.ui-switch__control[aria-checked='true'] .ui-switch__thumb {
  background: var(--ui-color-action-primary);
}
.ui-switch__control:disabled {
  color: var(--ui-color-text-hint);
  cursor: not-allowed;
}
</style>
