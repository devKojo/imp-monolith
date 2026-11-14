<script setup lang="ts">
import { t, type AppTextKey } from '../../../i18n';
import { BLOCK_DEFS } from '../blocks';
import type { TemplateBlock } from '../types';

/**
 * The fields of a template, in the order participants see them. Reordering uses buttons rather
 * than drag and drop, so it works with a keyboard and a screen reader (UI-A11Y-08).
 */
defineProps<{ blocks: TemplateBlock[]; selectedId: string | null; readonly?: boolean }>();
const emit = defineEmits<{
  select: [id: string];
  move: [id: string, direction: -1 | 1];
  duplicate: [id: string];
  remove: [id: string];
}>();
</script>

<template>
  <UiCard as="section" aria-labelledby="pipeline-title" class="pipeline">
    <h2 id="pipeline-title" class="ui-text-h3">
      {{ t('tpl.pipeline') }}
      <span class="ui-text-hint ui-text-body-s">({{ blocks.length }})</span>
    </h2>
    <p v-if="blocks.length === 0" class="ui-text-caption ui-text-hint">
      {{ t('tpl.pipeline.empty') }}
    </p>
    <ol v-else class="pipeline__list">
      <li v-for="(b, i) in blocks" :key="b.id" class="row" :data-selected="b.id === selectedId">
        <button
          type="button"
          class="row__main"
          :aria-label="t('tpl.row.edit', { item: b.label })"
          :aria-pressed="b.id === selectedId"
          :disabled="readonly"
          @click="emit('select', b.id)"
        >
          <UiIcon :name="BLOCK_DEFS[b.kind].icon" :size="18" />
          <span class="row__text">
            <span class="ui-text-label">{{
              b.label || t(`tpl.block.${b.kind}` as AppTextKey)
            }}</span>
            <span class="ui-text-caption ui-text-hint">{{ b.key }}</span>
          </span>
          <UiBadge :tone="b.required ? 'info' : 'neutral'">{{
            b.required ? t('tpl.required') : t('tpl.optional')
          }}</UiBadge>
        </button>
        <div v-if="!readonly" class="row__actions">
          <UiButton
            variant="tertiary"
            size="xs"
            icon="arrow-up"
            :disabled="i === 0"
            @click="emit('move', b.id, -1)"
          >
            <span class="ui-sr-only">{{ t('tpl.row.up', { item: b.label }) }}</span>
          </UiButton>
          <UiButton
            variant="tertiary"
            size="xs"
            icon="arrow-down"
            :disabled="i === blocks.length - 1"
            @click="emit('move', b.id, 1)"
          >
            <span class="ui-sr-only">{{ t('tpl.row.down', { item: b.label }) }}</span>
          </UiButton>
          <UiButton variant="tertiary" size="xs" icon="copy" @click="emit('duplicate', b.id)">
            <span class="ui-sr-only">{{ t('tpl.row.duplicate', { item: b.label }) }}</span>
          </UiButton>
          <UiButton variant="tertiary" size="xs" icon="trash" @click="emit('remove', b.id)">
            <span class="ui-sr-only">{{ t('tpl.row.remove', { item: b.label }) }}</span>
          </UiButton>
        </div>
      </li>
    </ol>
  </UiCard>
</template>

<style scoped>
.pipeline {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.pipeline h2,
.pipeline p {
  margin: 0;
}
.pipeline__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.row[data-selected='true'] {
  border-color: var(--ui-color-action-primary);
  background: var(--ui-color-selected-bg);
}
.row__main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--ui-space-3);
  min-inline-size: 0;
  padding: var(--ui-space-1) 0;
  background: none;
  border: 0;
  color: var(--ui-color-text-primary);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}
.row__actions {
  display: flex;
  gap: var(--ui-space-1);
}
</style>
