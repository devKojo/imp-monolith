<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

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
  }>(),
  { persistent: false },
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
    :aria-labelledby="titleId"
    :aria-describedby="description ? descId : undefined"
    @cancel="onCancel"
  >
    <div v-if="open" class="ui-dialog__inner">
      <h2 :id="titleId" class="ui-dialog__title ui-text-h2">{{ title }}</h2>
      <p v-if="description" :id="descId" class="ui-dialog__desc">{{ description }}</p>
      <div class="ui-dialog__body"><slot /></div>
      <div class="ui-dialog__footer"><slot name="footer" /></div>
    </div>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  inline-size: min(calc(100% - var(--ui-space-8)), calc(var(--ui-space-12) * 11));
  padding: var(--ui-space-6);
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-3);
}
.ui-dialog::backdrop {
  background: color-mix(in srgb, var(--ui-color-overlay) 60%, transparent);
}
.ui-dialog__title {
  margin: 0 0 var(--ui-space-2);
}
.ui-dialog__desc {
  margin: 0 0 var(--ui-space-4);
  color: var(--ui-color-text-secondary);
}
.ui-dialog__body {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.ui-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  margin-block-start: var(--ui-space-5);
}
</style>
