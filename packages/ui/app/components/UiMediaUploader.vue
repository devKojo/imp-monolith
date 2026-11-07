<script setup lang="ts">
import { computed, ref } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import UiLiveRegion from './UiLiveRegion.vue';
import UiProgress from './UiProgress.vue';

export type UploadState = 'choosing' | 'uploading' | 'validating' | 'approved' | 'rejected';

/**
 * Media uploader (spec 5, UI-PUB-16): choosing, uploading, validating (quarantine), approved,
 * rejected with a reason. Operable by keyboard without drag; accepted types and size are always
 * stated. The parent owns the real upload pipeline and drives `state`.
 */
const props = withDefaults(
  defineProps<{
    state?: UploadState;
    fileName?: string;
    progress?: number;
    reason?: string;
    /** Human list of accepted types, e.g. "JPG, PNG or WebP". */
    types: string;
    /** Human size limit, e.g. "5 MB". */
    maxSize: string;
    /** MIME list for the file input's accept attribute. */
    accept?: string;
  }>(),
  { state: 'choosing', fileName: '' },
);

const emit = defineEmits<{ select: [file: File]; remove: [] }>();
const input = ref<HTMLInputElement | null>(null);
const name = computed(() => props.fileName || 'file');
const announce = computed(() => {
  switch (props.state) {
    case 'uploading':
      return uiText('uploader.uploading', { name: name.value });
    case 'validating':
      return uiText('uploader.validating', { name: name.value });
    case 'approved':
      return uiText('uploader.approved', { name: name.value });
    case 'rejected':
      return uiText('uploader.rejected', { name: name.value, reason: props.reason ?? '' });
    default:
      return '';
  }
});
function onChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) emit('select', file);
  (e.target as HTMLInputElement).value = ''; // allow choosing the same file again after a rejection
}
</script>

<template>
  <div
    class="ui-uploader"
    :data-state="state"
    :aria-busy="state === 'uploading' || state === 'validating' ? 'true' : undefined"
  >
    <input
      ref="input"
      class="ui-sr-only"
      type="file"
      tabindex="-1"
      aria-hidden="true"
      :accept="accept"
      @change="onChange"
    />
    <p class="ui-text-body-s ui-text-hint">
      {{ uiText('uploader.hint', { types, size: maxSize }) }}
    </p>

    <UiButton
      v-if="state === 'choosing' || state === 'rejected'"
      variant="secondary"
      icon="upload"
      @click="input?.click()"
    >
      {{ uiText('uploader.choose') }}
    </UiButton>
    <div v-if="state === 'uploading'" class="ui-uploader__row">
      <UiProgress :value="progress" :label="uiText('uploader.uploading', { name })" />
      <span class="ui-text-body-s">{{ progress ?? 0 }}%</span>
    </div>
    <p v-if="state === 'validating'" class="ui-uploader__row ui-text-body-s">
      <UiProgress :label="uiText('uploader.validating', { name })" />
      {{ uiText('uploader.validating', { name }) }}
    </p>
    <p v-if="state === 'approved'" class="ui-uploader__ok">
      <UiIcon name="check-circle" :size="18" /> {{ uiText('uploader.approved', { name }) }}
    </p>
    <p v-if="state === 'rejected'" class="ui-uploader__bad">
      <UiIcon name="alert-circle" :size="18" />
      {{ uiText('uploader.rejected', { name, reason: reason ?? '' }) }}
    </p>
    <UiButton v-if="state === 'approved'" variant="tertiary" icon="trash" @click="emit('remove')">{{
      uiText('uploader.remove')
    }}</UiButton>
    <UiLiveRegion :message="announce" />
  </div>
</template>

<style scoped>
.ui-uploader {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-2);
  padding: var(--ui-space-4);
  border: 1px dashed var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
}
.ui-uploader p {
  margin: 0;
}
.ui-uploader__row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  inline-size: 100%;
}
.ui-uploader__row :deep(.ui-progress) {
  flex: 1;
}
.ui-uploader__ok,
.ui-uploader__bad {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.ui-uploader__ok {
  color: var(--ui-color-success-text);
}
.ui-uploader__bad {
  color: var(--ui-color-danger-text);
}
</style>
