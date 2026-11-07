<script setup lang="ts">
import { computed } from 'vue';
import { uiText } from '../composables/useUiText';
import UiFormField from './UiFormField.vue';

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
  }>(),
  { type: 'text', rows: 4 },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const nearLimit = computed(
  () => !!props.maxlength && props.modelValue.length >= props.maxlength * 0.8,
);
const onInput = (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value);
</script>

<template>
  <UiFormField
    :id="id"
    v-slot="field"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
  >
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
    <p v-if="nearLimit" class="ui-text-body-s ui-text-hint">
      {{ uiText('form.maxLength', { used: modelValue.length, max: maxlength ?? 0 }) }}
    </p>
  </UiFormField>
</template>
