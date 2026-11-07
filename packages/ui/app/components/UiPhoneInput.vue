<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import { formatPhoneForDisplay } from '../utils/phone';
import UiFormField from './UiFormField.vue';

withDefaults(
  defineProps<{
    modelValue: string;
    country: string;
    label?: string;
    countries?: Array<{ code: string; label: string }>;
    hint?: string;
    error?: string;
    required?: boolean;
    id?: string;
  }>(),
  {
    countries: () => [
      { code: 'GH', label: 'Ghana (+233)' },
      { code: 'NG', label: 'Nigeria (+234)' },
      { code: 'KE', label: 'Kenya (+254)' },
    ],
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:country': [value: string];
}>();

/** Accepts local and international formats and pasted values; formats on blur, never blocks input. */
function onBlur(e: FocusEvent) {
  const input = e.target as HTMLInputElement;
  emit('update:modelValue', formatPhoneForDisplay(input.value));
}
</script>

<template>
  <UiFormField
    :id="id"
    v-slot="field"
    :label="label ?? uiText('phone.number')"
    :hint="hint ?? uiText('phone.hint')"
    :error="error"
    :required="required"
  >
    <div class="ui-phone">
      <select
        class="ui-control ui-phone__country"
        :aria-label="uiText('phone.country')"
        :value="country"
        autocomplete="country"
        @change="emit('update:country', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.label }}</option>
      </select>
      <input
        :id="field.id"
        class="ui-control"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        :value="modelValue"
        :required="required"
        :aria-invalid="field.invalid ? 'true' : undefined"
        :aria-describedby="field.describedBy"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="onBlur"
      />
    </div>
  </UiFormField>
</template>

<style scoped>
.ui-phone {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.ui-phone__country {
  flex: 0 0 auto;
  inline-size: auto;
  max-inline-size: 100%;
}
.ui-phone .ui-control:not(.ui-phone__country) {
  flex: 1 1 var(--ui-space-12);
  min-inline-size: calc(var(--ui-space-12) * 3);
}
</style>
