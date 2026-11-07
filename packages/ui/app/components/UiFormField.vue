<script setup lang="ts">
import { computed, useId } from 'vue';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';

/**
 * The single wrapper behind every labelled control (UI-A11Y-04): persistent visible label (the
 * placeholder is never the label), required stated in text, help text linked by aria-describedby,
 * and an error that replaces the help text and pairs an icon with text.
 * Text inputs, selects, phone, OTP, date/time and choice groups all reuse it.
 *
 * `labelAside` puts a secondary link on the label row ("Forgot password?"). `hideLabel` keeps the
 * label for assistive tech but hides it visually; use it only where the control's purpose is
 * unmistakable from a visible button, such as a search box.
 */
const props = defineProps<{
  label: string;
  /** Override the generated id (error summaries link to it). */
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  hideLabel?: boolean;
}>();

const generated = useId();
const id = computed(() => props.id ?? `field-${generated}`);
const hintId = computed(() => `${id.value}-hint`);
const errorId = computed(() => `${id.value}-error`);
const invalid = computed(() => !!props.error);
const describedBy = computed(() =>
  props.error ? errorId.value : props.hint ? hintId.value : undefined,
);
</script>

<template>
  <div class="ui-field" :data-invalid="invalid">
    <div class="ui-field__head" :class="{ 'ui-sr-only': hideLabel }">
      <label :for="id" class="ui-field__label ui-text-label">
        {{ label }}
        <span class="ui-field__req ui-text-body-s">{{
          required ? `(${uiText('common.required').toLowerCase()})` : ''
        }}</span>
      </label>
      <slot name="labelAside" />
    </div>
    <slot :id="id" :described-by="describedBy" :invalid="invalid" />
    <p v-if="error" :id="errorId" class="ui-field__error ui-text-body-s">
      <UiIcon name="alert-circle" :size="16" />
      <span>{{ error }}</span>
    </p>
    <p v-else-if="hint" :id="hintId" class="ui-field__hint ui-text-body-s ui-text-hint">
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.ui-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.ui-field__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-field__label {
  font-weight: 600;
  color: var(--ui-color-text-secondary);
}
.ui-field__req {
  font-weight: 400;
  color: var(--ui-color-text-hint);
}
.ui-field__hint,
.ui-field__error {
  margin: 0;
}
.ui-field__error {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-1);
  color: var(--ui-color-danger-text);
}
</style>
