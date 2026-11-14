<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from '@imp/ui/app/composables/useToast';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import { templateErrorKey } from '../../../modules/templates/errors';
import type { TemplateSummary } from '../../../modules/templates/types';
import { useTemplates } from '../../../modules/templates/useTemplates';

/**
 * Template library: every template of the active business, from the API, with the actions that
 * matter (open, duplicate, delete) and a way to start a new one. Client-rendered and private like
 * the rest of the console. What a role may do decides which actions are offered; the server decides
 * what is allowed.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('tpl.title') });

const store = useTemplates();
const { canManage } = store;
const toast = useToast();

const items = ref<TemplateSummary[]>([]);
const loading = ref(true);
const loadFailed = ref(false);
const problem = ref('');

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    items.value = await store.list();
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function attempt(action: () => Promise<void>) {
  problem.value = '';
  try {
    await action();
  } catch (e) {
    problem.value = t(templateErrorKey(toApiError(e)));
  }
}

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
  items.value.filter(
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
    fields: tpl.fieldCount,
    updated: day(tpl.updatedAt),
  })),
);
const filtering = computed(() => query.value.trim() !== '' || status.value !== 'all');

const creating = ref(false);
const createNew = () =>
  attempt(async () => {
    creating.value = true;
    try {
      const created = await store.create(t('tpl.newName'), 'giveaway');
      await navigateTo(`/app/templates/${created.id}`);
    } finally {
      creating.value = false;
    }
  });

const copy = (id: string) =>
  attempt(async () => {
    await store.duplicate(id);
    await load();
    toast.push(t('tpl.duplicated'));
  });

const toDelete = ref<{ id: string; name: string } | null>(null);
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (open: boolean) => {
    if (!open) toDelete.value = null;
  },
});
const confirmDelete = () =>
  attempt(async () => {
    if (!toDelete.value) return;
    const { id } = toDelete.value;
    toDelete.value = null;
    await store.remove(id);
    await load();
    toast.push(t('tpl.deleted'));
  });
</script>

<template>
  <BusinessShell current="templates">
    <template #search>
      <UiSearchField v-model="query" :label="t('tpl.search')" />
    </template>
    <template v-if="canManage" #actions>
      <UiButton
        size="xs"
        icon="plus"
        :loading="creating"
        :loading-label="t('tpl.creating')"
        @click="createNew"
      >
        {{ t('tpl.new') }}
      </UiButton>
    </template>

    <header class="page-head">
      <h1 class="ui-text-h1">{{ t('tpl.title') }}</h1>
      <p v-if="!canManage" class="ui-text-caption ui-text-hint">{{ t('tpl.readonly.role') }}</p>
    </header>

    <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

    <UiSystemState v-if="loadFailed" kind="generic" @action="load" />
    <section v-else class="table-card" aria-labelledby="templates-title">
      <div class="table-card__head">
        <h2 id="templates-title" class="ui-text-h3">
          {{ t('tpl.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ items.length }})</span>
        </h2>
        <UiSegmentedControl v-model="status" :label="t('tpl.filter')" :options="statusOptions" />
      </div>
      <UiDataTable
        flush
        :name="t('tpl.title')"
        :columns="columns"
        :rows="rows"
        :loading="loading"
        row-key="id"
      >
        <template #cell-name="{ row }">
          <UiLink :to="`/app/templates/${String(row.id)}`">{{ row.name }}</UiLink>
        </template>
        <template #cell-status="{ row }">
          <UiStatusChip vocabulary="template" :status="String(row.status)" />
        </template>
        <template #cell-actions="{ row }">
          <span class="actions">
            <UiButton :to="`/app/templates/${String(row.id)}`" variant="tertiary" size="xs">
              {{ canManage && row.status === 'DRAFT' ? t('tpl.edit') : t('tpl.view') }}
            </UiButton>
            <UiButton v-if="canManage" variant="tertiary" size="xs" @click="copy(String(row.id))">
              {{ t('tpl.duplicate') }}
            </UiButton>
            <UiButton
              v-if="canManage && row.status === 'DRAFT'"
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
            <UiButton v-if="!filtering && canManage" size="xs" icon="plus" @click="createNew">
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
