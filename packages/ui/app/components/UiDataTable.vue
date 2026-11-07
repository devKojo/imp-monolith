<script setup lang="ts">
import { computed } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiEmptyState from './UiEmptyState.vue';
import UiIcon from './UiIcon.vue';
import UiSkeleton from './UiSkeleton.vue';

export type Column = {
  key: string;
  label: string;
  sortable?: boolean;
  /** Columns collapse by priority as the viewport narrows (UI-DSH-06). Default: high. */
  priority?: 'high' | 'medium' | 'low';
};
export type SortState = { key: string; direction: 'asc' | 'desc' } | null;

/**
 * Data table (UI-DSH-04/06): sticky header, sortable columns, focusable named scroll container,
 * priority column collapse, keyset "Load more" and stacked cards below 768 px. Cells render through
 * `#cell-<key>` slots, so status chips, masked values and row actions reuse their own components.
 */
const props = withDefaults(
  defineProps<{
    /** Accessible name for the table and its scroll region. */
    name: string;
    columns: Column[];
    rows: Array<Record<string, unknown>>;
    rowKey: string;
    sort?: SortState;
    loading?: boolean;
    hasMore?: boolean;
    total?: number;
    density?: 'comfortable' | 'compact';
  }>(),
  { sort: null, density: 'comfortable' },
);

const emit = defineEmits<{ 'update:sort': [sort: SortState]; loadMore: [] }>();

function toggleSort(col: Column) {
  if (!col.sortable) return;
  const dir = props.sort?.key === col.key && props.sort.direction === 'asc' ? 'desc' : 'asc';
  emit('update:sort', { key: col.key, direction: dir });
}
const ariaSort = (col: Column) =>
  props.sort?.key === col.key
    ? props.sort.direction === 'asc'
      ? 'ascending'
      : 'descending'
    : col.sortable
      ? 'none'
      : undefined;
const showing = computed(() =>
  props.total ? uiText('table.showing', { shown: props.rows.length, total: props.total }) : '',
);
</script>

<template>
  <div class="ui-table-wrap" :data-density="density">
    <UiSkeleton v-if="loading && rows.length === 0" variant="table" />
    <slot v-else-if="rows.length === 0" name="empty"
      ><UiEmptyState :title="uiText('state.empty.title')" :description="uiText('state.empty.body')"
    /></slot>
    <div
      v-else
      class="ui-table-scroll"
      role="region"
      tabindex="0"
      :aria-label="uiText('table.scrollRegion', { name })"
    >
      <table class="ui-table">
        <caption class="ui-sr-only">
          {{
            name
          }}
        </caption>
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              scope="col"
              :data-priority="c.priority ?? 'high'"
              :aria-sort="ariaSort(c)"
            >
              <button v-if="c.sortable" type="button" class="ui-table__sort" @click="toggleSort(c)">
                {{ c.label }}
                <UiIcon
                  v-if="sort?.key === c.key"
                  :name="sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'"
                  :size="14"
                />
              </button>
              <template v-else>{{ c.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row[rowKey])">
            <td
              v-for="c in columns"
              :key="c.key"
              :data-label="c.label"
              :data-priority="c.priority ?? 'high'"
            >
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="rows.length > 0" class="ui-table__foot">
      <span class="ui-text-body-s ui-text-hint">{{ showing }}</span>
      <UiButton v-if="hasMore" variant="secondary" :loading="loading" @click="emit('loadMore')">{{
        uiText('table.loadMore')
      }}</UiButton>
    </div>
  </div>
</template>

<style scoped>
.ui-table-scroll {
  max-block-size: 70vh;
  overflow: auto;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.ui-table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--ui-font-body-s-size);
  line-height: var(--ui-font-body-s-line);
}
th,
td {
  padding: var(--ui-space-3) var(--ui-space-4);
  text-align: start;
  border-block-end: 1px solid var(--ui-color-border);
}
[data-density='compact'] th,
[data-density='compact'] td {
  padding-block: var(--ui-space-1);
}
th {
  position: sticky;
  inset-block-start: 0;
  background: var(--ui-color-surface-subtle);
  color: var(--ui-color-text-secondary);
  font-weight: 600;
}
tbody tr:nth-child(even) {
  background: var(--ui-color-surface-subtle);
}
.ui-table__sort {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: 0;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
}
.ui-table__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block-start: var(--ui-space-3);
}
/* Collapse by priority: low hides below lg, medium below md. */
@media (max-width: 1023px) {
  [data-priority='low'] {
    display: none;
  }
}
/* Below md: stacked cards with a visible label per value (UI-DSH-04). */
@media (max-width: 767px) {
  [data-priority='medium'] {
    display: revert;
  }
  .ui-table,
  .ui-table tbody,
  .ui-table tr,
  .ui-table td {
    display: block;
  }
  .ui-table thead {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .ui-table tr {
    padding: var(--ui-space-2) 0;
    border-block-end: 1px solid var(--ui-color-border-strong);
  }
  td {
    display: flex;
    gap: var(--ui-space-3);
    justify-content: space-between;
    border: 0;
  }
  td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--ui-color-text-secondary);
  }
  [data-priority='low'] {
    display: flex;
  }
}
</style>
