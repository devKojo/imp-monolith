<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import UiTextInput from './UiTextInput.vue';

/**
 * Confirm and destructive confirmation (UI-DSH-13). The primary action is a verb + object
 * ("Run draw", never "OK"). A destructive dialog states the consequence and, when the action
 * cannot be undone, asks for a typed phrase before the button enables.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    /** What will happen, in plain words. */
    consequence: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant?: 'confirm' | 'destructive';
    /** Phrase the user must type, e.g. the campaign name. */
    typedPhrase?: string;
    loading?: boolean;
  }>(),
  { variant: 'confirm' },
);

const emit = defineEmits<{ 'update:open': [open: boolean]; confirm: []; cancel: [] }>();
const typed = ref('');
watch(
  () => props.open,
  (o) => o && (typed.value = ''),
);

const matches = computed(() => !props.typedPhrase || typed.value.trim() === props.typedPhrase);
const cancel = () => {
  emit('update:open', false);
  emit('cancel');
};
</script>

<template>
  <UiDialog
    :open="open"
    :title="title"
    :description="consequence"
    :persistent="variant === 'destructive'"
    @update:open="cancel"
  >
    <UiTextInput
      v-if="typedPhrase"
      v-model="typed"
      :label="uiText('dialog.typeToConfirm', { phrase: typedPhrase })"
      autocomplete="off"
    />
    <template #footer>
      <UiButton variant="secondary" @click="cancel">{{
        cancelLabel ?? uiText('common.cancel')
      }}</UiButton>
      <UiButton
        :variant="variant === 'destructive' ? 'danger' : 'primary'"
        :loading="loading"
        :disabled="!matches"
        :disabled-reason="
          !matches ? uiText('dialog.typeToConfirm', { phrase: typedPhrase ?? '' }) : undefined
        "
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </UiButton>
    </template>
  </UiDialog>
</template>
