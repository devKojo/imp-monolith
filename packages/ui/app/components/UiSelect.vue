<script setup lang="ts">
import UiFormField from './UiFormField.vue';

defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  name?: string;
  autocomplete?: string;
  id?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
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
    <select
      :id="field.id"
      class="ui-control"
      :value="modelValue"
      :name="name"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :aria-invalid="field.invalid ? 'true' : undefined"
      :aria-describedby="field.describedBy"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </UiFormField>
</template>
