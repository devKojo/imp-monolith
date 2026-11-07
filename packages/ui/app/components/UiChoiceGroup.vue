<script setup lang="ts">
import { computed, useId } from 'vue';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';

/**
 * Native radio group. `cards` is the radio-card pattern for poll, vote and quiz options: the whole
 * card is clickable and at least 44 px tall (spec 5, UI-PUB-13).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    legend: string;
    options: Array<{ value: string; label: string; description?: string }>;
    variant?: 'cards' | 'list';
    hint?: string;
    error?: string;
    required?: boolean;
    name?: string;
  }>(),
  { variant: 'cards' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const generated = useId();
const groupName = computed(() => props.name ?? `choice-${generated}`);
const errorId = computed(() => `${groupName.value}-e`);
const hintId = computed(() => `${groupName.value}-h`);
</script>

<template>
  <fieldset
    class="ui-choice"
    :aria-describedby="error ? errorId : hint ? hintId : undefined"
    :aria-invalid="error ? 'true' : undefined"
  >
    <legend class="ui-choice__legend">
      {{ legend }}
      <span v-if="required" class="ui-text-body-s ui-text-hint">{{
        uiText('common.requiredText')
      }}</span>
    </legend>
    <label
      v-for="o in options"
      :key="o.value"
      class="ui-choice__option"
      :data-variant="variant"
      :data-checked="modelValue === o.value"
    >
      <input
        type="radio"
        :name="groupName"
        :value="o.value"
        :checked="modelValue === o.value"
        @change="emit('update:modelValue', o.value)"
      />
      <span class="ui-choice__text">
        <span class="ui-choice__label">{{ o.label }}</span>
        <span v-if="o.description" class="ui-text-body-s ui-text-hint">{{ o.description }}</span>
      </span>
      <UiIcon v-if="modelValue === o.value" name="check" :size="18" />
    </label>
    <p v-if="error" :id="errorId" class="ui-choice__error ui-text-body-s">
      <UiIcon name="alert-circle" :size="16" /> {{ error }}
    </p>
    <p v-else-if="hint" :id="hintId" class="ui-text-body-s ui-text-hint ui-choice__note">
      {{ hint }}
    </p>
  </fieldset>
</template>

<style scoped>
.ui-choice {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}
.ui-choice__legend {
  padding: 0;
  margin-block-end: var(--ui-space-1);
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
.ui-choice__option {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  min-block-size: var(--ui-target-public);
  padding: var(--ui-space-3) var(--ui-space-4);
  cursor: pointer;
}
.ui-choice__option[data-variant='cards'] {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-md);
}
.ui-choice__option[data-checked='true'][data-variant='cards'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
  border-width: var(--ui-focus-width);
}
.ui-choice__option:has(input:focus-visible) {
  outline: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  outline-offset: var(--ui-focus-offset);
}
input {
  flex: none;
  inline-size: var(--ui-space-5);
  block-size: var(--ui-space-5);
  accent-color: var(--ui-color-action-primary);
}
.ui-choice__text {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.ui-choice__label {
  font-weight: 600;
}
.ui-choice__error {
  display: flex;
  gap: var(--ui-space-1);
  margin: 0;
  color: var(--ui-color-danger-text);
}
.ui-choice__note {
  margin: 0;
}
</style>
