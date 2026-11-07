<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiTextInput from './UiTextInput.vue';

/**
 * Search form (role="search"): a text field with a search icon, a clear button when there is text,
 * and a visible Search button. The label is kept for assistive tech but hidden visually because
 * the button names the purpose; pass `show-label` to display it.
 */
defineProps<{
  modelValue: string;
  /** Accessible name, e.g. "Search campaigns". */
  label: string;
  hint?: string;
  showLabel?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string]; search: [query: string] }>();
</script>

<template>
  <form role="search" class="ui-search" @submit.prevent="emit('search', modelValue)">
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
        <UiButton variant="tertiary" icon="x" @click="emit('update:modelValue', '')">
          <span class="ui-sr-only">{{ uiText('search.clear') }}</span>
        </UiButton>
      </template>
    </UiTextInput>
    <UiButton type="submit">{{ uiText('search.submit') }}</UiButton>
  </form>
</template>

<style scoped>
.ui-search {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-2);
}
.ui-search__field {
  flex: 1;
  min-inline-size: 0;
}
</style>
