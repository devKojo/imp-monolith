<script setup lang="ts">
import { nextTick } from 'vue';
import { t } from '../../../i18n';
import { LIMITS, MIN_OPTIONS, addOption, removeOption, setOption } from '../logic';
import type { TemplateBlock } from '../types';

/** Edits the selected field. Changes are sent up as small patches; the page owns the data. */
const props = defineProps<{ block: TemplateBlock }>();
const emit = defineEmits<{
  update: [patch: Partial<Omit<TemplateBlock, 'id' | 'kind' | 'key'>>];
}>();

const optionId = (i: number) => `field-option-${props.block.id}-${i}`;
const setAt = (i: number, value: string) =>
  emit('update', { options: setOption(props.block.options, i, value) });
const removeAt = (i: number) => emit('update', { options: removeOption(props.block.options, i) });
async function add() {
  const next = addOption(props.block.options);
  emit('update', { options: next });
  await nextTick();
  document.getElementById(optionId(next.length - 1))?.focus();
}
</script>

<template>
  <UiCard as="section" aria-labelledby="inspector-title" class="inspector">
    <h2 id="inspector-title" class="ui-text-h3">{{ t('tpl.inspector') }}</h2>
    <p class="ui-text-caption ui-text-hint">{{ t('tpl.field.key', { key: block.key }) }}</p>
    <UiTextInput
      :id="`field-label-${block.id}`"
      :model-value="block.label"
      :label="t('tpl.field.label')"
      :maxlength="LIMITS.label"
      @update:model-value="emit('update', { label: $event })"
    />
    <fieldset v-if="block.kind === 'choice'" class="options">
      <legend class="ui-text-label">{{ t('tpl.field.options') }}</legend>
      <p class="ui-text-caption ui-text-hint">
        {{ t('tpl.field.optionsHint', { max: LIMITS.options }) }}
      </p>
      <ol class="options__list">
        <li v-for="(option, i) in block.options" :key="i" class="options__row">
          <UiTextInput
            :id="optionId(i)"
            class="options__input"
            :model-value="option"
            :label="t('tpl.option.label', { n: i + 1 })"
            hide-label
            :maxlength="LIMITS.option"
            @update:model-value="setAt(i, $event)"
          />
          <UiButton
            variant="tertiary"
            size="xs"
            icon="x"
            :disabled="block.options.length <= MIN_OPTIONS"
            @click="removeAt(i)"
          >
            <span class="ui-sr-only">{{ t('tpl.option.remove', { n: i + 1 }) }}</span>
          </UiButton>
        </li>
      </ol>
      <UiButton
        variant="secondary"
        size="xs"
        icon="plus"
        :disabled="block.options.length >= LIMITS.options"
        @click="add"
      >
        {{ t('tpl.option.add') }}
      </UiButton>
    </fieldset>
    <UiTextInput
      :id="`field-helper-${block.id}`"
      :model-value="block.helper"
      :label="t('tpl.field.helper')"
      :maxlength="LIMITS.helper"
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
.options {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  align-items: flex-start;
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}
.options__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  inline-size: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.options__row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.options__input {
  flex: 1;
  min-inline-size: 0;
}
</style>
