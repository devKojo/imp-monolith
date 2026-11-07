<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiTextInput from './UiTextInput.vue';

/**
 * Step-up authentication for PII export, role changes, API-key creation and elevation (R-IAM-03,
 * UI-DSH-07). Explains that the purpose is audited and requires it before the button enables.
 */
const props = defineProps<{
  open: boolean;
  /** What the user is about to do, e.g. "Export participants". */
  action: string;
  loading?: boolean;
  /** Error from the server, e.g. a wrong code. Input is kept. */
  error?: string;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  confirm: [payload: { purpose: string; code: string }];
  cancel: [];
}>();
const purpose = ref('');
const code = ref('');
watch(
  () => props.open,
  (o) => o && ((purpose.value = ''), (code.value = '')),
);
const ready = computed(() => purpose.value.trim().length >= 5 && /^\d{6}$/.test(code.value));
const cancel = () => {
  emit('update:open', false);
  emit('cancel');
};
</script>

<template>
  <UiDialog
    :open="open"
    :title="uiText('stepUp.title')"
    :description="action"
    @update:open="cancel"
  >
    <UiTextInput
      v-model="purpose"
      multiline
      :rows="3"
      required
      :label="uiText('stepUp.purpose')"
      :hint="uiText('stepUp.purposeHint')"
    />
    <UiTextInput
      v-model="code"
      required
      inputmode="numeric"
      autocomplete="one-time-code"
      :maxlength="6"
      :label="uiText('stepUp.code')"
      :error="error"
    />
    <template #footer>
      <UiButton variant="secondary" @click="cancel">{{ uiText('common.cancel') }}</UiButton>
      <UiButton
        :loading="loading"
        :disabled="!ready"
        :disabled-reason="!ready ? uiText('stepUp.needBoth') : undefined"
        @click="emit('confirm', { purpose: purpose.trim(), code })"
      >
        {{ uiText('stepUp.confirm') }}
      </UiButton>
    </template>
  </UiDialog>
</template>
