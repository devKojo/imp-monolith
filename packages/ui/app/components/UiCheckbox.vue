<script setup lang="ts">
import { computed, useId } from 'vue';
import UiIcon from './UiIcon.vue';

/** For form values. Use UiSwitch only for settings that apply immediately (spec 5). */
const props = defineProps<{
  modelValue: boolean;
  label: string;
  description?: string;
  error?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const generated = useId();
const id = computed(() => props.id ?? `check-${generated}`);
const describedBy = computed(
  () =>
    [props.description && `${id.value}-d`, props.error && `${id.value}-e`]
      .filter(Boolean)
      .join(' ') || undefined,
);
</script>

<template>
  <div class="ui-checkbox">
    <label class="ui-checkbox__row" :for="id">
      <input
        :id="id"
        type="checkbox"
        :checked="modelValue"
        :name="name"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span class="ui-checkbox__label"
        ><slot>{{ label }}</slot></span
      >
    </label>
    <p v-if="description" :id="`${id}-d`" class="ui-text-body-s ui-text-hint ui-checkbox__text">
      {{ description }}
    </p>
    <p v-if="error" :id="`${id}-e`" class="ui-text-body-s ui-checkbox__error ui-checkbox__text">
      <UiIcon name="alert-circle" :size="16" /> {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ui-checkbox__row {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3);
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  cursor: pointer;
}
input {
  flex: none;
  inline-size: var(--ui-space-6);
  block-size: var(--ui-space-6);
  margin: var(--ui-space-2) 0 0;
  accent-color: var(--ui-color-action-primary);
}
.ui-checkbox__label {
  padding-block: var(--ui-space-2);
}
.ui-checkbox__text {
  margin: 0;
  padding-inline-start: calc(var(--ui-space-6) + var(--ui-space-3));
}
.ui-checkbox__error {
  display: flex;
  gap: var(--ui-space-1);
  color: var(--ui-color-danger-text);
}
</style>
