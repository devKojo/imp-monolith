<script setup lang="ts">
import { t } from '../../../i18n';
import type { TemplateBlock } from '../types';

/**
 * What a participant will be asked, built from the same fields. The form is inert: it is a picture
 * of the entry form, so nothing in it can be focused or submitted.
 */
defineProps<{ name: string; blocks: TemplateBlock[]; device: 'mobile' | 'desktop' }>();

const likert = ['1', '2', '3', '4', '5'];
const inputType = (kind: TemplateBlock['kind']) =>
  kind === 'email' ? 'email' : kind === 'phone' ? 'tel' : 'text';
const choices = (b: TemplateBlock) =>
  b.options.filter((o) => o.trim() !== '').map((o, i) => ({ value: String(i), label: o }));
</script>

<template>
  <div class="frame" :data-device="device">
    <p class="frame__title ui-text-label">{{ name }}</p>
    <p v-if="blocks.length === 0" class="ui-text-caption ui-text-hint">
      {{ t('tpl.preview.empty') }}
    </p>
    <div v-else class="form" inert>
      <template v-for="b in blocks" :key="b.id">
        <UiCheckbox
          v-if="b.kind === 'consent'"
          :model-value="false"
          :label="b.label"
          :description="b.helper || undefined"
        />
        <UiChoiceGroup
          v-else-if="b.kind === 'choice'"
          model-value=""
          variant="list"
          :legend="b.label"
          :hint="b.helper || undefined"
          :required="b.required"
          :options="choices(b)"
        />
        <UiSegmentedControl
          v-else-if="b.kind === 'likert'"
          model-value=""
          :label="b.label"
          :options="likert.map((v) => ({ value: v, label: v }))"
        />
        <div v-else-if="b.kind === 'upload'" class="upload">
          <p class="ui-text-label">{{ b.label }}</p>
          <UiButton variant="secondary" size="xs" icon="upload">{{
            t('tpl.preview.file')
          }}</UiButton>
        </div>
        <UiTextInput
          v-else
          :model-value="''"
          :type="inputType(b.kind)"
          :label="b.label"
          :hint="b.helper || undefined"
          :required="b.required"
        />
      </template>
      <UiButton block size="xs" icon-trailing="arrow-right">{{ t('tpl.preview.submit') }}</UiButton>
    </div>
  </div>
</template>

<style scoped>
.frame {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin-inline: auto;
  padding: var(--ui-space-5);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  inline-size: 100%;
}
.frame[data-device='mobile'] {
  max-inline-size: calc(var(--ui-space-12) * 7);
}
.frame p {
  margin: 0;
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.upload {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  align-items: flex-start;
}
</style>
