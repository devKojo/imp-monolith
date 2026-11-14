<script setup lang="ts">
import { t, type AppTextKey } from '../../../i18n';
import { BLOCK_DEFS, ENGAGEMENT_KINDS, IDENTITY_KINDS } from '../blocks';
import type { BlockKind } from '../types';

/** The fields a template can ask for, grouped. One click adds a field to the end of the pipeline. */
const emit = defineEmits<{ add: [kind: BlockKind] }>();
const groups = [
  { id: 'identity', kinds: IDENTITY_KINDS },
  { id: 'engagement', kinds: ENGAGEMENT_KINDS },
] as const;
</script>

<template>
  <UiCard as="section" aria-labelledby="palette-title" class="palette">
    <h2 id="palette-title" class="ui-text-h3">{{ t('tpl.palette') }}</h2>
    <div
      v-for="g in groups"
      :key="g.id"
      class="palette__group"
      role="group"
      :aria-label="t(`tpl.group.${g.id}` as AppTextKey)"
    >
      <p class="ui-text-caption ui-text-hint">{{ t(`tpl.group.${g.id}` as AppTextKey) }}</p>
      <div class="palette__items">
        <UiButton
          v-for="kind in g.kinds"
          :key="kind"
          variant="secondary"
          size="xs"
          :icon="BLOCK_DEFS[kind].icon"
          @click="emit('add', kind)"
        >
          {{ t(`tpl.block.${kind}` as AppTextKey) }}
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.palette h2,
.palette p {
  margin: 0;
}
.palette__group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.palette__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
