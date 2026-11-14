<script setup lang="ts">
import { t } from '../../../i18n';
import { LIMITS } from '../logic';
import type { Prize } from '../types';

/**
 * The prize tiers of a campaign, in the order the page shows them. Reordering uses buttons rather than
 * drag and drop, so it works with a keyboard and a screen reader (UI-A11Y-08). Changes are sent up;
 * the page owns the data.
 */
defineProps<{ prizes: Prize[]; readonly?: boolean }>();
const emit = defineEmits<{
  add: [];
  update: [id: string, patch: Partial<Omit<Prize, 'id'>>];
  move: [id: string, direction: -1 | 1];
  remove: [id: string];
}>();

/** Winners is a whole number from 1; anything else typed is brought back into range. */
const winnersFrom = (value: string) =>
  Math.min(LIMITS.winners, Math.max(1, Math.floor(Number(value)) || 1));
</script>

<template>
  <UiCard as="section" aria-labelledby="prizes-title" class="prizes">
    <div class="prizes__head">
      <h2 id="prizes-title" class="ui-text-h3">
        {{ t('cmp.prizes') }}
        <span class="ui-text-hint ui-text-body-s">({{ prizes.length }})</span>
      </h2>
      <UiButton
        v-if="!readonly"
        variant="secondary"
        size="xs"
        icon="plus"
        :disabled="prizes.length >= LIMITS.prizes"
        @click="emit('add')"
      >
        {{ t('cmp.prize.add') }}
      </UiButton>
    </div>

    <p v-if="prizes.length === 0" class="ui-text-caption ui-text-hint">
      {{ t('cmp.prizes.empty') }}
    </p>

    <ol v-else class="prizes__list">
      <li v-for="(p, i) in prizes" :key="p.id" class="prize">
        <div class="prize__head">
          <strong class="ui-text-label">{{ t('cmp.prize.item', { n: i + 1 }) }}</strong>
          <div v-if="!readonly" class="prize__actions">
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-up"
              :disabled="i === 0"
              @click="emit('move', p.id, -1)"
            >
              <span class="ui-sr-only">{{
                t('cmp.prize.up', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-down"
              :disabled="i === prizes.length - 1"
              @click="emit('move', p.id, 1)"
            >
              <span class="ui-sr-only">{{
                t('cmp.prize.down', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
            <UiButton variant="tertiary" size="xs" icon="trash" @click="emit('remove', p.id)">
              <span class="ui-sr-only">{{
                t('cmp.prize.remove', { item: p.name || String(i + 1) })
              }}</span>
            </UiButton>
          </div>
        </div>
        <div class="prize__fields">
          <UiTextInput
            :id="`prize-name-${p.id}`"
            :model-value="p.name"
            :label="t('cmp.prize.name')"
            :maxlength="LIMITS.prizeName"
            :readonly="readonly"
            @update:model-value="emit('update', p.id, { name: $event })"
          />
          <UiTextInput
            :id="`prize-value-${p.id}`"
            :model-value="p.valueLabel"
            :label="t('cmp.prize.value')"
            :maxlength="LIMITS.prizeValue"
            :readonly="readonly"
            @update:model-value="emit('update', p.id, { valueLabel: $event })"
          />
          <UiTextInput
            :id="`prize-winners-${p.id}`"
            type="number"
            inputmode="numeric"
            :model-value="String(p.winners)"
            :label="t('cmp.prize.winners')"
            :readonly="readonly"
            @update:model-value="emit('update', p.id, { winners: winnersFrom($event) })"
          />
        </div>
        <UiTextInput
          :id="`prize-description-${p.id}`"
          :model-value="p.description"
          :label="t('cmp.prize.description')"
          :maxlength="LIMITS.prizeDescription"
          :readonly="readonly"
          @update:model-value="emit('update', p.id, { description: $event })"
        />
      </li>
    </ol>
  </UiCard>
</template>

<style scoped>
.prizes {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.prizes h2,
.prizes p {
  margin: 0;
}
.prizes__head,
.prize__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.prizes__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.prize {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.prize__actions {
  display: flex;
  gap: var(--ui-space-1);
}
.prize__fields {
  display: grid;
  gap: var(--ui-space-3);
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 640px) {
  .prize__fields {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
