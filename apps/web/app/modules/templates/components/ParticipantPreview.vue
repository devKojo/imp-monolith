<script setup lang="ts">
import { t } from '../../../i18n';
import type { TemplateBlock } from '../types';

/**
 * What a participant will be asked, built from the same fields. The form is inert: it is a picture
 * of the entry form, so nothing in it can be focused or submitted.
 */
defineProps<{
  name: string;
  blocks: TemplateBlock[];
  device: 'mobile' | 'desktop';
  /** A taller window, for the full-size view. The content always scrolls inside the frame. */
  tall?: boolean;
}>();

const likert = ['1', '2', '3', '4', '5'];
const inputType = (kind: TemplateBlock['kind']) =>
  kind === 'email' ? 'email' : kind === 'phone' ? 'tel' : 'text';
const choices = (b: TemplateBlock) =>
  b.options.filter((o) => o.trim() !== '').map((o, i) => ({ value: String(i), label: o }));
</script>

<template>
  <div class="frame" :data-device="device" :data-tall="tall ? 'true' : undefined">
    <div class="frame__bar" aria-hidden="true">
      <span v-if="device === 'desktop'" class="frame__dots"><i /><i /><i /></span>
      <span v-else class="frame__notch" />
    </div>
    <div
      class="frame__screen"
      tabindex="0"
      role="region"
      :aria-label="t('tpl.preview.scroll', { name })"
    >
      <h3 class="frame__title ui-text-h3">{{ name }}</h3>
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
            v-else-if="b.kind === 'long_text'"
            multiline
            :rows="4"
            :model-value="''"
            :label="b.label"
            :hint="b.helper || undefined"
            :required="b.required"
          />
          <UiTextInput
            v-else
            :model-value="''"
            :type="inputType(b.kind)"
            :label="b.label"
            :hint="b.helper || undefined"
            :required="b.required"
          />
        </template>
        <UiButton block size="xs" icon-trailing="arrow-right">{{
          t('tpl.preview.submit')
        }}</UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.frame {
  display: flex;
  flex-direction: column;
  margin-inline: auto;
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-elevation-2);
  inline-size: 100%;
}
.frame[data-device='mobile'] {
  max-inline-size: calc(var(--ui-space-12) * 7);
}
.frame__bar {
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: var(--ui-space-6);
  padding-inline: var(--ui-space-3);
  background: var(--ui-color-surface-muted, var(--ui-color-bg-subtle, var(--ui-color-surface)));
  border-block-end: 1px solid var(--ui-color-border);
}
.frame[data-device='desktop'] .frame__bar {
  justify-content: flex-start;
}
.frame__dots {
  display: inline-flex;
  gap: var(--ui-space-1);
}
.frame__dots i {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-border-strong);
}
.frame__notch {
  inline-size: var(--ui-space-8);
  block-size: var(--ui-space-1);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-border-strong);
}
.frame__screen {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5);
  /* The window stays a fixed height however many fields there are; the content scrolls. */
  max-block-size: calc(var(--ui-space-12) * 9);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.frame[data-tall='true'] .frame__screen {
  max-block-size: 70vh;
}
.frame__screen:focus-visible {
  outline: 2px solid var(--ui-color-focus-ring, var(--ui-color-action-primary));
  outline-offset: -2px;
}
.frame__screen p,
.frame__title {
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
