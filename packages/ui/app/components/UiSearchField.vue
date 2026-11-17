<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiTextInput from './UiTextInput.vue';

/**
 * Search form (role="search"): a text field with a search icon, a clear button when there is text,
 * and a visible Search button. The label is kept for assistive tech but hidden visually because
 * the button names the purpose; pass `show-label` to display it. `compact` is the quiet, extra small
 * form for filtering a list in place.
 */
defineProps<{
  modelValue: string;
  /** Accessible name, e.g. "Search campaigns". */
  label: string;
  hint?: string;
  showLabel?: boolean;
  /** Extra small and quiet: no raised bar and no Search button (Enter searches), for use inside a table card. */
  compact?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; search: [query: string] }>();
</script>

<template>
  <form role="search" class="ui-search" :data-compact="compact" @submit.prevent="emit('search', modelValue)">
    <UiTextInput
      class="ui-search__field"
      type="search"
      icon="search"
      inputmode="search"
      autocomplete="off"
      :model-value="modelValue"
      :label="label"
      :hint="hint"
      :hide-label="!showLabel"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template v-if="modelValue" #suffix>
        <UiButton variant="tertiary" size="xs" icon="x" @click="emit('update:modelValue', '')">
          <span class="ui-sr-only">{{ uiText('search.clear') }}</span>
        </UiButton>
      </template>
    </UiTextInput>
    <UiButton v-if="!compact" type="submit" size="xs">{{ uiText('search.submit') }}</UiButton>
  </form>
</template>

<style scoped>
/* One raised bar: the field and the Search button share a single rounded surface. */
.ui-search {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-1);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-md);
  transition: border-color var(--ui-motion-fast) ease;
}
.ui-search:focus-within {
  border-color: var(--ui-color-focus-ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-focus-ring) 18%, transparent);
}
/* The browser draws its own clear button in a search input; this field has its own, so hide that one. */
.ui-search__field :deep(input[type='search']::-webkit-search-cancel-button) {
  display: none;
  appearance: none;
}
/* Compact: a flat, small field with a hairline edge that only strengthens on focus. */
.ui-search[data-compact='true'] {
  --ui-control-target: calc(var(--ui-space-6) + var(--ui-space-1));
  inline-size: 100%;
  max-inline-size: 16rem;
  padding: 0;
  background: var(--ui-color-surface-subtle);
  border-color: var(--ui-color-border);
  border-radius: var(--ui-radius-md);
  box-shadow: none;
}
.ui-search[data-compact='true']:focus-within {
  background: var(--ui-color-surface);
}
.ui-search[data-compact='true'] :deep(.ui-control) {
  font-size: var(--ui-font-body-s-size);
}
.ui-search__field {
  flex: 1;
  min-inline-size: 0;
}
/* The bar carries the visible edge (it keeps its own 1 px border); the inner field is flat. */
.ui-search__field :deep(.ui-control) {
  background: transparent;
  border-color: transparent;
}
.ui-search__field :deep(.ui-control:focus-visible) {
  border-color: transparent;
  box-shadow: none;
}
</style>
