<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import UiLiveRegion from './UiLiveRegion.vue';

const props = defineProps<{
  /** Text placed on the clipboard. */
  value: string;
  /** What is being copied, for the accessible name: "Copy snapshot hash". */
  what: string;
}>();

const message = ref('');
const ok = ref(true);
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Feedback is a miniature toast anchored to the button, not the app-wide toaster: inside a modal dialog
 * (the share link) the page's toaster sits behind the dialog and would never be seen.
 */
async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    ok.value = true;
    message.value = uiText('common.copied');
  } catch {
    ok.value = false; // clipboard blocked: the value is still visible next to the button
    message.value = uiText('common.copyFailed');
  }
  clearTimeout(timer);
  timer = setTimeout(() => (message.value = ''), 2000);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <span class="ui-copy">
    <UiButton variant="tertiary" icon="copy" @click="copy">
      {{ uiText('common.copy') }}<span class="ui-sr-only"> {{ what }}</span>
    </UiButton>
    <span
      v-if="message"
      class="ui-copy__toast ui-text-caption"
      :data-tone="ok ? 'success' : 'error'"
      aria-hidden="true"
    >
      <UiIcon :name="ok ? 'check-circle' : 'alert-circle'" :size="16" />
      {{ message }}
    </span>
    <UiLiveRegion :message="message" />
  </span>
</template>

<style scoped>
.ui-copy {
  position: relative;
  display: inline-flex;
}
.ui-copy__toast {
  position: absolute;
  inset-block-end: 100%;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  margin-block-end: var(--ui-space-1);
  padding: var(--ui-space-1) var(--ui-space-2);
  white-space: nowrap;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-2);
  color: var(--ui-color-success-text);
  pointer-events: none;
}
.ui-copy__toast[data-tone='error'] {
  color: var(--ui-color-danger-text);
}
@media (prefers-reduced-motion: no-preference) {
  .ui-copy__toast {
    animation: ui-copy-pop 120ms ease-out;
  }
}
@keyframes ui-copy-pop {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
}
</style>
