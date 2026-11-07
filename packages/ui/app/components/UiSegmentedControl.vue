<script setup lang="ts">
/**
 * A compact single-choice switch for views of the same data (All / Live / Scheduled / Paused).
 * Built on native radio inputs: arrow keys move the choice, the group has a name, and the selected
 * option is shown by a raised fill plus heavier text, not colour alone.
 */
const props = defineProps<{
  modelValue: string;
  options: Array<{ value: string; label: string }>;
  /** Accessible name of the group (what is being filtered). */
  label: string;
  name?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const groupName = props.name ?? `seg-${props.label.toLowerCase().replace(/\W+/g, '-')}`;
</script>

<template>
  <div class="ui-seg" role="radiogroup" :aria-label="label">
    <label v-for="o in options" :key="o.value" class="ui-seg__opt">
      <input
        class="ui-seg__input"
        type="radio"
        :name="groupName"
        :value="o.value"
        :checked="modelValue === o.value"
        @change="emit('update:modelValue', o.value)"
      />
      <span class="ui-seg__label ui-text-label">{{ o.label }}</span>
    </label>
  </div>
</template>

<style scoped>
.ui-seg {
  display: inline-flex;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.ui-seg__opt {
  position: relative;
  display: inline-flex;
}
.ui-seg__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.ui-seg__label {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: 0 var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  color: var(--ui-color-text-secondary);
  pointer-events: none;
}
.ui-seg__input:checked + .ui-seg__label {
  background: var(--ui-color-surface);
  box-shadow: var(--ui-elevation-1);
  color: var(--ui-color-text-primary);
  font-weight: 700;
}
.ui-seg__input:hover:not(:checked) + .ui-seg__label {
  color: var(--ui-color-text-primary);
}
.ui-seg__input:focus-visible + .ui-seg__label {
  outline: var(--ui-focus-width) solid var(--ui-color-focus-ring);
  outline-offset: var(--ui-focus-offset);
}
</style>
