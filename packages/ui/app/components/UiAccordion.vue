<script setup lang="ts">
import { ref, useId } from 'vue';
import UiIcon from './UiIcon.vue';

/** Disclosure list ("How it works", FAQ). Must not hide required information on public pages. */
const props = defineProps<{ items: Array<{ id: string; title: string }>; openIds?: string[] }>();
const uid = useId();
const open = ref<Set<string>>(new Set(props.openIds ?? []));
const toggle = (id: string) => (open.value.has(id) ? open.value.delete(id) : open.value.add(id));
</script>

<template>
  <div class="ui-accordion">
    <div v-for="item in items" :key="item.id" class="ui-accordion__item">
      <h3 class="ui-accordion__heading">
        <button
          :id="`${uid}-b-${item.id}`"
          type="button"
          class="ui-accordion__trigger"
          :aria-expanded="open.has(item.id)"
          :aria-controls="`${uid}-p-${item.id}`"
          @click="toggle(item.id)"
        >
          <span>{{ item.title }}</span>
          <UiIcon :name="open.has(item.id) ? 'chevron-up' : 'chevron-down'" :size="18" />
        </button>
      </h3>
      <div
        v-show="open.has(item.id)"
        :id="`${uid}-p-${item.id}`"
        role="region"
        :aria-labelledby="`${uid}-b-${item.id}`"
        class="ui-accordion__panel"
      >
        <slot :name="`item-${item.id}`" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-accordion__item {
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-accordion__heading {
  margin: 0;
  font: inherit;
}
.ui-accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  inline-size: 100%;
  min-block-size: var(--ui-control-target, var(--ui-target-public));
  padding: var(--ui-space-3) 0;
  background: none;
  color: var(--ui-color-text-primary);
  border: 0;
  font: inherit;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.ui-accordion__panel {
  padding-block-end: var(--ui-space-4);
}
</style>
