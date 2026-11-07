<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiCheckbox from './UiCheckbox.vue';
import UiLink from './UiLink.vue';

export type ConsentValue = { accepted: boolean; optional: Record<string, boolean> };
type Purpose = { id: string; label: string; description: string; version: string; href: string };

/**
 * Unbundled consent (UI-PUB-10): required terms are separate from optional purposes; optional
 * boxes start unticked; every purpose has a plain-language description and links to its versioned
 * text. The caller records the text version with the answer.
 */
const props = defineProps<{
  modelValue: ConsentValue;
  legend: string;
  terms: { label: string; version: string; href: string };
  optional?: Purpose[];
  error?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: ConsentValue] }>();
const setOptional = (id: string, on: boolean) =>
  emit('update:modelValue', {
    ...props.modelValue,
    optional: { ...props.modelValue.optional, [id]: on },
  });
</script>

<template>
  <fieldset class="ui-consent">
    <legend class="ui-consent__legend ui-text-h3">{{ legend }}</legend>
    <UiCheckbox
      :model-value="modelValue.accepted"
      :label="`${terms.label} (${uiText('consent.required').toLowerCase()})`"
      :error="error"
      @update:model-value="emit('update:modelValue', { ...modelValue, accepted: $event })"
    />
    <p class="ui-text-body-s ui-consent__link">
      <UiLink :to="terms.href">{{ uiText('consent.readText', { version: terms.version }) }}</UiLink>
    </p>
    <template v-if="optional?.length">
      <p class="ui-consent__heading ui-text-body">{{ uiText('consent.optionalHeading') }}</p>
      <div v-for="p in optional" :key="p.id" class="ui-consent__purpose">
        <UiCheckbox
          :model-value="modelValue.optional[p.id] ?? false"
          :label="p.label"
          :description="p.description"
          @update:model-value="setOptional(p.id, $event)"
        />
        <p class="ui-text-body-s ui-consent__link">
          <UiLink :to="p.href">{{ uiText('consent.readText', { version: p.version }) }}</UiLink>
        </p>
      </div>
    </template>
  </fieldset>
</template>

<style scoped>
.ui-consent {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}
.ui-consent__legend {
  padding: 0;
  margin-block-end: var(--ui-space-2);
}
.ui-consent__heading {
  margin: var(--ui-space-4) 0 0;
  font-weight: 600;
}
.ui-consent__link {
  margin: 0;
  padding-inline-start: calc(var(--ui-space-6) + var(--ui-space-3));
}
</style>
