<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import type { TemplateBlock } from '../types';

/** Edits the selected field. Changes are sent up as small patches; the page owns the data. */
const props = defineProps<{ block: TemplateBlock }>();
const emit = defineEmits<{
  update: [patch: Partial<Omit<TemplateBlock, 'id' | 'kind' | 'key'>>];
}>();

const optionsText = computed(() => props.block.options.join('\n'));
const setOptions = (value: string) => emit('update', { options: value.split('\n') });
</script>

<template>
  <UiCard as="section" aria-labelledby="inspector-title" class="inspector">
    <h2 id="inspector-title" class="ui-text-h3">{{ t('tpl.inspector') }}</h2>
    <p class="ui-text-caption ui-text-hint">{{ t('tpl.field.key', { key: block.key }) }}</p>
    <UiTextInput
      :id="`field-label-${block.id}`"
      :model-value="block.label"
      :label="t('tpl.field.label')"
      @update:model-value="emit('update', { label: $event })"
    />
    <UiTextInput
      v-if="block.kind === 'choice'"
      :id="`field-options-${block.id}`"
      multiline
      :rows="4"
      :model-value="optionsText"
      :label="t('tpl.field.options')"
      :hint="t('tpl.field.optionsHint')"
      @update:model-value="setOptions"
    />
    <UiTextInput
      :id="`field-helper-${block.id}`"
      :model-value="block.helper"
      :label="t('tpl.field.helper')"
      @update:model-value="emit('update', { helper: $event })"
    />
    <UiCheckbox
      :id="`field-required-${block.id}`"
      :model-value="block.required"
      :label="t('tpl.field.required')"
      @update:model-value="emit('update', { required: $event })"
    />
  </UiCard>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.inspector h2,
.inspector p {
  margin: 0;
}
</style>
