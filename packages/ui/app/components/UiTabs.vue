<script setup lang="ts">
import { nextTick, useId } from 'vue';

/**
 * Native tab roles with arrow-key navigation (spec 5). Not for hiding required information on
 * public pages. Panels render through `#panel-<id>` slots.
 */
const props = defineProps<{
  modelValue: string;
  tabs: Array<{ id: string; label: string }>;
  label: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();
const uid = useId();

async function onKey(e: KeyboardEvent, i: number) {
  const last = props.tabs.length - 1;
  const next = {
    ArrowRight: i === last ? 0 : i + 1,
    ArrowLeft: i === 0 ? last : i - 1,
    Home: 0,
    End: last,
  }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  emit('update:modelValue', props.tabs[next]!.id);
  await nextTick();
  document.getElementById(`${uid}-tab-${props.tabs[next]!.id}`)?.focus();
}
</script>

<template>
  <div class="ui-tabs">
    <div role="tablist" :aria-label="label" class="ui-tabs__list">
      <button
        v-for="(t, i) in tabs"
        :id="`${uid}-tab-${t.id}`"
        :key="t.id"
        type="button"
        role="tab"
        class="ui-tabs__tab"
        :aria-selected="modelValue === t.id"
        :aria-controls="`${uid}-panel-${t.id}`"
        :tabindex="modelValue === t.id ? 0 : -1"
        @click="emit('update:modelValue', t.id)"
        @keydown="onKey($event, i)"
      >
        {{ t.label }}
      </button>
    </div>
    <div
      v-for="t in tabs"
      v-show="modelValue === t.id"
      :id="`${uid}-panel-${t.id}`"
      :key="t.id"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="`${uid}-tab-${t.id}`"
      class="ui-tabs__panel"
    >
      <slot :name="`panel-${t.id}`" />
    </div>
  </div>
</template>

<style scoped>
.ui-tabs__list {
  display: flex;
  gap: var(--ui-space-1);
  border-block-end: 1px solid var(--ui-color-border);
  overflow-x: auto;
}
.ui-tabs__tab {
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  padding: var(--ui-space-2) var(--ui-space-4);
  background: none;
  color: var(--ui-color-text-secondary);
  border: 0;
  border-block-end: var(--ui-focus-width) solid transparent;
  font: inherit;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.ui-tabs__tab[aria-selected='true'] {
  color: var(--ui-color-selected-text);
  border-block-end-color: var(--ui-color-action-primary);
}
.ui-tabs__panel {
  padding-block: var(--ui-space-4);
}
</style>
