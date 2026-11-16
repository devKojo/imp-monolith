<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';

/**
 * Base modal (spec 5): native <dialog> so focus is trapped and Escape works without scripting;
 * focus returns to the trigger on close; the title is an h2; no click-outside dismissal (avoids
 * accidental data loss). `persistent` also blocks Escape when closing could lose work.
 * Confirm, destructive, conflict and step-up dialogs are all built on this one component.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    persistent?: boolean;
    /** `lg` is for content that needs room, such as charts. */
    size?: 'md' | 'lg';
    /** Adds a close icon button to the header. */
    closable?: boolean;
  }>(),
  { persistent: false, size: 'md', closable: false },
);

const emit = defineEmits<{ 'update:open': [open: boolean]; close: [] }>();
const el = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const descId = useId();
let trigger: HTMLElement | null = null;

function show() {
  trigger = document.activeElement as HTMLElement | null;
  const d = el.value;
  if (!d || d.open) return;
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
}

function hide() {
  const d = el.value;
  if (!d) return;
  if (typeof d.close === 'function') d.close();
  else d.removeAttribute('open');
  void nextTick(() => trigger?.focus?.());
}

watch(
  () => props.open,
  (open) => (open ? show() : hide()),
  { flush: 'post' },
);
onBeforeUnmount(() => el.value?.open && hide());

function onCancel(e: Event) {
  e.preventDefault(); // we control closing so the parent stays the source of truth
  if (!props.persistent) request();
}
function request() {
  emit('update:open', false);
  emit('close');
}
</script>

<template>
  <dialog
    ref="el"
    class="ui-dialog"
    :data-size="size"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descId : undefined"
    @cancel="onCancel"
  >
    <div v-if="open" class="ui-dialog__inner">
      <header class="ui-dialog__head">
        <div class="ui-dialog__titles">
          <h2 :id="titleId" class="ui-dialog__title ui-text-h2">{{ title }}</h2>
          <p v-if="description" :id="descId" class="ui-dialog__desc">{{ description }}</p>
        </div>
        <UiButton v-if="closable" variant="tertiary" size="xs" icon="x" @click="request">
          <span class="ui-sr-only">{{ uiText('common.close') }}</span>
        </UiButton>
      </header>
      <div class="ui-dialog__body"><slot /></div>
      <div v-if="$slots.footer" class="ui-dialog__footer"><slot name="footer" /></div>
    </div>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  inline-size: min(calc(100% - var(--ui-space-8)), calc(var(--ui-space-12) * 11));
  max-block-size: calc(100dvh - var(--ui-space-8));
  padding: 0;
  overflow: hidden;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-elevation-3);
}
.ui-dialog[data-size='lg'] {
  inline-size: min(calc(100% - var(--ui-space-8)), calc(var(--ui-space-12) * 16));
}
.ui-dialog[open] {
  display: flex;
  flex-direction: column;
}
.ui-dialog::backdrop {
  background: color-mix(in srgb, var(--ui-color-overlay) 60%, transparent);
}
.ui-dialog__inner {
  display: flex;
  flex-direction: column;
  min-block-size: 0;
  max-block-size: calc(100dvh - var(--ui-space-8));
}
.ui-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-dialog__titles {
  min-inline-size: 0;
}
.ui-dialog__title {
  margin: 0;
}
.ui-dialog__desc {
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-color-text-secondary);
}
.ui-dialog__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: var(--ui-space-3);
  min-block-size: 0;
  padding: var(--ui-space-5) var(--ui-space-6);
  overflow-y: auto;
}
.ui-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  padding: var(--ui-space-4) var(--ui-space-6);
  border-block-start: 1px solid var(--ui-color-border);
}
</style>
