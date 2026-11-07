<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { provideToasts } from '../composables/useToast';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';

/**
 * Wrap the app (or shell) once. Toasts auto-dismiss after 6 s, pause on hover and focus, are
 * announced politely, and never take focus (spec 5). Place below the sticky header so a toast
 * does not cover the focused element (UI-A11Y-02).
 */
const props = withDefaults(defineProps<{ duration?: number }>(), { duration: 6000 });
const api = provideToasts();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function start(id: number) {
  stop(id);
  timers.set(
    id,
    setTimeout(() => api.dismiss(id), props.duration),
  );
}
function stop(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}
function track(el: unknown, id: number) {
  if (el && !timers.has(id)) start(id);
}
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t)));
</script>

<template>
  <slot />
  <section class="ui-toaster" :aria-label="uiText('toast.region')">
    <div role="status" aria-live="polite" class="ui-toaster__list">
      <div
        v-for="t in api.toasts"
        :key="t.id"
        :ref="(el) => track(el, t.id)"
        class="ui-toast"
        :data-tone="t.tone"
        @mouseenter="stop(t.id)"
        @mouseleave="start(t.id)"
        @focusin="stop(t.id)"
        @focusout="start(t.id)"
      >
        <UiIcon :name="t.tone === 'success' ? 'check-circle' : 'info'" :size="20" />
        <span class="ui-toast__message">{{ t.message }}</span>
        <UiButton variant="tertiary" icon="x" @click="api.dismiss(t.id)">
          <span class="ui-sr-only">{{ uiText('common.dismiss') }}</span>
        </UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ui-toaster {
  position: fixed;
  inset-block-end: var(--ui-space-4);
  inset-inline: var(--ui-space-4);
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.ui-toaster__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  inline-size: min(100%, calc(var(--ui-space-12) * 9));
}
.ui-toast {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-2);
  pointer-events: auto;
}
.ui-toast[data-tone='success'] {
  color: var(--ui-color-success-text);
}
.ui-toast[data-tone='info'] {
  color: var(--ui-color-info-text);
}
.ui-toast__message {
  flex: 1;
  color: var(--ui-color-text-primary);
}
</style>
