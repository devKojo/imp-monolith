<script setup lang="ts">
import { computed } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';

/**
 * Page controls for a long list or table: "Showing 11-20 of 134", previous and next, and a short run of
 * page numbers with the first and last always reachable. The page the person is on is marked with
 * `aria-current`; every button has a text name. Pages count from 1. The page that owns the data decides
 * whether it slices a list or asks the server for a page; this only reports the chosen page.
 */
const props = withDefaults(
  defineProps<{
    total: number;
    pageSize: number;
    /** Accessible name of the navigation, for pages with more than one list. */
    label?: string;
    /** Keep the previous/next and page buttons even when everything fits on one page. */
    alwaysShowControls?: boolean;
  }>(),
  { alwaysShowControls: false },
);
const page = defineModel<number>('page', { default: 1 });

const count = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const current = computed(() => Math.min(Math.max(1, page.value), count.value));
const from = computed(() => (props.total === 0 ? 0 : (current.value - 1) * props.pageSize + 1));
const to = computed(() => Math.min(props.total, current.value * props.pageSize));

/** 1 … 4 5 6 … 20: the ends, the current page and its neighbours; a gap is shown once as an ellipsis. */
const items = computed<Array<number | 'gap-start' | 'gap-end'>>(() => {
  const last = count.value;
  const wanted = new Set([1, last, current.value - 1, current.value, current.value + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: Array<number | 'gap-start' | 'gap-end'> = [];
  pages.forEach((p, i) => {
    const prev = pages[i - 1];
    if (prev !== undefined && p - prev > 1) out.push(i === 1 ? 'gap-start' : 'gap-end');
    out.push(p);
  });
  return out;
});

const go = (to: number) => {
  page.value = Math.min(Math.max(1, to), count.value);
};
</script>

<template>
  <nav class="ui-pager" :aria-label="label ?? uiText('pagination.label')">
    <p class="ui-pager__range ui-text-body-s ui-text-hint" role="status">
      {{ uiText('pagination.showing', { from, to, total }) }}
    </p>
    <ul v-if="count > 1 || alwaysShowControls" class="ui-pager__list">
      <li>
        <UiButton
          variant="secondary"
          size="xs"
          icon="chevron-left"
          :disabled="current === 1"
          @click="go(current - 1)"
        >
          <span class="ui-sr-only">{{ uiText('pagination.previous') }}</span>
        </UiButton>
      </li>
      <li v-for="item in items" :key="item">
        <span v-if="typeof item === 'string'" class="ui-pager__gap" aria-hidden="true">…</span>
        <UiButton
          v-else
          :variant="item === current ? 'primary' : 'secondary'"
          size="xs"
          :aria-current="item === current ? 'page' : undefined"
          :aria-label="uiText('pagination.page', { n: item })"
          @click="go(item)"
        >
          {{ item }}
        </UiButton>
      </li>
      <li>
        <UiButton
          variant="secondary"
          size="xs"
          icon="chevron-right"
          :disabled="current === count"
          @click="go(current + 1)"
        >
          <span class="ui-sr-only">{{ uiText('pagination.next') }}</span>
        </UiButton>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.ui-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-pager__range {
  margin: 0;
}
.ui-pager__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-pager__gap {
  display: inline-block;
  min-inline-size: var(--ui-space-6);
  text-align: center;
  color: var(--ui-color-text-hint);
}
</style>
