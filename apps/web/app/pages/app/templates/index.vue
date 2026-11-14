<script setup lang="ts">
import { computed, ref } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import { useTemplates } from '../../../modules/templates/useTemplates';

/**
 * Template library: every template the business has, with the actions that matter (open,
 * duplicate, delete) and a way to start a new one. Client-rendered and private like the rest of
 * the console. Templates are labelled samples until the templates API exists.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('tpl.title') });

const { templates, create, duplicate, remove } = useTemplates();

const query = ref('');
const status = ref('all');
const statusOptions = [
  { value: 'all', label: t('tpl.filter.all') },
  { value: 'draft', label: t('tpl.filter.draft') },
  { value: 'published', label: t('tpl.filter.published') },
];
const columns = [
  { key: 'name', label: t('tpl.col.name') },
  { key: 'type', label: t('tpl.col.type'), priority: 'medium' as const },
  { key: 'status', label: t('tpl.col.status') },
  { key: 'fields', label: t('tpl.col.fields'), priority: 'medium' as const },
  { key: 'updated', label: t('tpl.col.updated'), priority: 'medium' as const },
  { key: 'actions', label: t('tpl.col.actions') },
];

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const filtered = computed(() =>
  templates.value.filter(
    (tpl) =>
      (status.value === 'all' || tpl.status.toLowerCase() === status.value) &&
      (!query.value || tpl.name.toLowerCase().includes(query.value.trim().toLowerCase())),
  ),
);
const rows = computed(() =>
  filtered.value.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    type: t(`tpl.archetype.${tpl.archetype}` as AppTextKey),
    status: tpl.status,
    fields: tpl.blocks.length,
    updated: day(tpl.updatedAt),
  })),
);
const filtering = computed(() => query.value.trim() !== '' || status.value !== 'all');

async function createNew() {
  const created = create(t('tpl.newName'), 'giveaway');
  await navigateTo(`/app/templates/${created.id}`);
}
function copy(id: string, name: string) {
  duplicate(id, t('tpl.copyName', { name }));
}

const toDelete = ref<{ id: string; name: string } | null>(null);
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open) toDelete.value = null;
  },
});
function confirmDelete() {
  if (toDelete.value) remove(toDelete.value.id);
  toDelete.value = null;
}
</script>

<template>
  <BusinessShell current="templates">
    <template #search>
      <UiSearchField v-model="query" :label="t('tpl.search')" />
    </template>
    <template #actions>
      <UiButton size="xs" icon="plus" @click="createNew">{{ t('tpl.new') }}</UiButton>
    </template>

    <header class="page-head">
      <h1 class="ui-text-h1">{{ t('tpl.title') }}</h1>
      <p class="ui-text-caption ui-text-hint">{{ t('tpl.sample') }}</p>
    </header>

    <section class="table-card" aria-labelledby="templates-title">
      <div class="table-card__head">
        <h2 id="templates-title" class="ui-text-h3">
          {{ t('tpl.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ templates.length }})</span>
        </h2>
        <UiSegmentedControl v-model="status" :label="t('tpl.filter')" :options="statusOptions" />
      </div>
      <UiDataTable flush :name="t('tpl.title')" :columns="columns" :rows="rows" row-key="id">
        <template #cell-name="{ row }">
          <UiLink :to="`/app/templates/${String(row.id)}`">{{ row.name }}</UiLink>
        </template>
        <template #cell-status="{ row }">
          <UiStatusChip vocabulary="template" :status="String(row.status)" />
        </template>
        <template #cell-actions="{ row }">
          <span class="actions">
            <UiButton :to="`/app/templates/${String(row.id)}`" variant="tertiary" size="xs">
              {{ t('tpl.edit') }}
            </UiButton>
            <UiButton variant="tertiary" size="xs" @click="copy(String(row.id), String(row.name))">
              {{ t('tpl.duplicate') }}
            </UiButton>
            <UiButton
              variant="tertiary"
              size="xs"
              @click="toDelete = { id: String(row.id), name: String(row.name) }"
            >
              {{ t('tpl.delete') }}
            </UiButton>
          </span>
        </template>
        <template #empty>
          <UiEmptyState
            :title="filtering ? t('tpl.noMatch.title') : t('tpl.empty.title')"
            :description="filtering ? t('tpl.noMatch.body') : t('tpl.empty.body')"
          >
            <UiButton v-if="!filtering" size="xs" icon="plus" @click="createNew">
              {{ t('tpl.new') }}
            </UiButton>
          </UiEmptyState>
        </template>
      </UiDataTable>
    </section>

    <UiConfirmDialog
      v-model:open="deleteOpen"
      variant="destructive"
      :title="t('tpl.delete.title')"
      :consequence="t('tpl.delete.consequence', { name: toDelete?.name ?? '' })"
      :confirm-label="t('tpl.delete')"
      @confirm="confirmDelete"
    />
  </BusinessShell>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin-block-end: var(--ui-space-8);
}
.page-head h1,
.page-head p {
  margin: 0;
}
.table-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
}
.table-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.table-card__head h2 {
  margin: 0;
}
.actions {
  display: inline-flex;
  gap: var(--ui-space-1);
}
</style>
