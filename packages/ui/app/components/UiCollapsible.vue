<script setup lang="ts">
import { useId } from 'vue';
import UiIcon from './UiIcon.vue';

/**
 * A card section that folds away: a heading row that toggles its content. Use it to keep a long form or
 * dashboard scannable. The state is `v-model:open`, so a page can open or close several together. While
 * folded the optional `summary` says what is inside, so closing a section never hides its meaning.
 */
withDefaults(
  defineProps<{
    title: string;
    /** One line shown under the title while the section is folded. */
    summary?: string;
    /** Whether the content shows. Folded sections stay in the page, so unsaved input is kept. */
    open?: boolean;
    headingLevel?: 2 | 3 | 4;
  }>(),
  { open: true, headingLevel: 2 },
);
const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const uid = useId();
</script>

<template>
  <section class="ui-collapsible" :aria-labelledby="`${uid}-t`" :data-open="open">
    <component :is="`h${headingLevel}`" class="ui-collapsible__heading">
      <button
        :id="`${uid}-b`"
        type="button"
        class="ui-collapsible__trigger"
        :aria-expanded="open"
        :aria-controls="`${uid}-p`"
        @click="emit('update:open', !open)"
      >
        <span class="ui-collapsible__text">
          <span :id="`${uid}-t`" class="ui-text-h3">{{ title }}</span>
          <span v-if="summary && !open" class="ui-text-caption ui-text-hint">{{ summary }}</span>
        </span>
        <UiIcon :name="open ? 'chevron-up' : 'chevron-down'" :size="20" />
      </button>
    </component>
    <div v-show="open" :id="`${uid}-p`" class="ui-collapsible__panel">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ui-collapsible {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.ui-collapsible__heading {
  margin: 0;
  font: inherit;
}
.ui-collapsible__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  inline-size: 100%;
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  padding: var(--ui-space-4) var(--ui-space-5);
  background: none;
  color: var(--ui-color-text-primary);
  border: 0;
  border-radius: var(--ui-radius-lg);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.ui-collapsible__text {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.ui-collapsible__panel {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: 0 var(--ui-space-5) var(--ui-space-5);
}
</style>
