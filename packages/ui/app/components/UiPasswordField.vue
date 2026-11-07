<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import UiLiveRegion from './UiLiveRegion.vue';
import UiProgress from './UiProgress.vue';
import UiTextInput from './UiTextInput.vue';

export type PasswordRule = { id: string; label: string; met: boolean };

/**
 * Password input with a show/hide toggle and an optional live requirements checklist. The rules are
 * passed in (the caller owns the policy, which the server enforces), so the component stays generic.
 * Each rule shows icon + text + a "met / not met" cue, never colour alone, and the met count is
 * announced politely only when it changes (not on every keystroke).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    /** `new-password` on sign-up and change; `current-password` on sign-in. */
    autocomplete?: 'new-password' | 'current-password';
    hint?: string;
    error?: string;
    required?: boolean;
    id?: string;
    name?: string;
    rules?: PasswordRule[];
  }>(),
  { autocomplete: 'current-password' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const shown = ref(false);

const total = computed(() => props.rules?.length ?? 0);
const metCount = computed(() => props.rules?.filter((r) => r.met).length ?? 0);
const progress = computed(() =>
  uiText('password.progress', { met: metCount.value, total: total.value }),
);
const announce = ref('');
watch(metCount, () => {
  if (total.value > 0 && props.modelValue) announce.value = progress.value;
});
</script>

<template>
  <div class="ui-password">
    <UiTextInput
      :id="id"
      :model-value="modelValue"
      :label="label ?? uiText('password.label')"
      :type="shown ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :hint="hint"
      :error="error"
      :required="required"
      :name="name"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template v-if="$slots.labelAside" #labelAside><slot name="labelAside" /></template>
      <template #suffix>
        <UiButton
          variant="tertiary"
          :icon="shown ? 'eye-off' : 'eye'"
          :aria-pressed="shown"
          @click="shown = !shown"
        >
          <span class="ui-sr-only">{{
            shown ? uiText('password.hide') : uiText('password.show')
          }}</span>
        </UiButton>
      </template>
    </UiTextInput>

    <div v-if="rules?.length" class="ui-password__rules">
      <UiProgress
        :value="(metCount / total) * 100"
        :label="uiText('password.requirements')"
        :tone="metCount === total ? 'success' : 'brand'"
      />
      <p class="ui-text-body-s ui-text-hint ui-password__count">{{ progress }}</p>
      <ul :aria-label="uiText('password.requirements')">
        <li v-for="r in rules" :key="r.id" :data-met="r.met" class="ui-text-body-s">
          <UiIcon :name="r.met ? 'check-circle' : 'circle'" :size="16" />
          <span>{{ r.label }}</span>
          <span class="ui-sr-only"
            >({{ r.met ? uiText('password.met') : uiText('password.notMet') }})</span
          >
        </li>
      </ul>
    </div>
    <UiLiveRegion :message="announce" />
  </div>
</template>

<style scoped>
.ui-password {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.ui-password__rules {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.ui-password__count {
  margin: 0;
}
ul {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-color-text-secondary);
}
li[data-met='true'] {
  color: var(--ui-color-success-text);
}
</style>
