<script setup lang="ts">
import { computed } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiFormField from './UiFormField.vue';
import UiIcon from './UiIcon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    /** Renders a textarea. */
    multiline?: boolean;
    rows?: number;
    type?: 'text' | 'email' | 'url' | 'password' | 'search' | 'tel' | 'number';
    name?: string;
    /** Correct autocomplete and inputmode prevent friction on mobile (UI-A11Y-04). */
    autocomplete?: string;
    inputmode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search';
    maxlength?: number;
    /** The counter is shown only when the limit matters (close to it). */
    id?: string;
    disabled?: boolean;
    readonly?: boolean;
    /** Decorative icon inside the control, before the text. */
    icon?: IconName;
    /** Keep the label for assistive tech only (see UiFormField). */
    hideLabel?: boolean;
  }>(),
  { type: 'text', rows: 4 },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const slots = defineSlots<{
  /** Control at the inline end of the field (for example a show/hide button). */
  suffix?: () => unknown;
  /** Link on the label row (for example "Forgot password?"). */
  labelAside?: () => unknown;
}>();

const nearLimit = computed(
  () => !!props.maxlength && props.modelValue.length >= props.maxlength * 0.8,
);
const onInput = (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value);
</script>

<template>
  <UiFormField
    :id="id"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    :hide-label="hideLabel"
  >
    <template v-if="slots.labelAside" #labelAside><slot name="labelAside" /></template>
    <template #default="field">
      <div class="ui-input" :data-icon="!!icon" :data-suffix="!!slots.suffix">
        <UiIcon v-if="icon" :name="icon" :size="18" class="ui-input__icon" />
        <component
          :is="multiline ? 'textarea' : 'input'"
          :id="field.id"
          class="ui-control"
          :value="modelValue"
          :type="multiline ? undefined : type"
          :rows="multiline ? rows : undefined"
          :name="name"
          :autocomplete="autocomplete"
          :inputmode="inputmode"
          :maxlength="maxlength"
          :required="required"
          :disabled="disabled"
          :readonly="readonly"
          :aria-invalid="field.invalid ? 'true' : undefined"
          :aria-describedby="field.describedBy"
          @input="onInput"
        />
        <span v-if="slots.suffix" class="ui-input__suffix"><slot name="suffix" /></span>
      </div>
      <p v-if="nearLimit" class="ui-text-body-s ui-text-hint">
        {{ uiText('form.maxLength', { used: modelValue.length, max: maxlength ?? 0 }) }}
      </p>
    </template>
  </UiFormField>
</template>

<style scoped>
.ui-input {
  position: relative;
  display: flex;
  align-items: center;
}
.ui-input__icon {
  position: absolute;
  inset-inline-start: var(--ui-space-3);
  color: var(--ui-color-text-hint);
  pointer-events: none;
}
.ui-input[data-icon='true'] .ui-control {
  padding-inline-start: calc(var(--ui-space-3) + var(--ui-space-6));
}
.ui-input__suffix {
  position: absolute;
  inset-inline-end: var(--ui-space-1);
  display: flex;
}
.ui-input[data-suffix='true'] .ui-control {
  padding-inline-end: calc(var(--ui-space-12) + var(--ui-space-1));
}
</style>
