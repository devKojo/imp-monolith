<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { useToast } from '@imp/ui/app/composables/useToast';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import { campaignErrorKey } from '../../../modules/campaigns/errors';
import { browserZone } from '../../../modules/campaigns/logic';
import type { CampaignSummary } from '../../../modules/campaigns/types';
import { useCampaigns } from '../../../modules/campaigns/useCampaigns';

/**
 * Campaign library: every campaign of the active business, from the API, with the actions that matter
 * (open, pause or resume, duplicate, delete) and a way to start a new one. Client-rendered and private
 * like the rest of the console. What a role may do decides which actions are offered; the server
 * decides what is allowed.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('cmp.title') });

const store = useCampaigns();
const { canManage, canOperate } = store;
const toast = useToast();
const zone = browserZone();

const items = ref<CampaignSummary[]>([]);
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
    problem.value = t(campaignErrorKey(toApiError(e)));
  }
}

const query = ref('');
const status = ref('all');
const statusOptions = [
  { value: 'all', label: t('cmp.filter.all') },
  { value: 'draft', label: t('cmp.filter.draft') },
  { value: 'scheduled', label: t('cmp.filter.scheduled') },
  { value: 'live', label: t('cmp.filter.live') },
  { value: 'paused', label: t('cmp.filter.paused') },
  { value: 'ended', label: t('cmp.filter.ended') },
];
const columns = [
  { key: 'name', label: t('cmp.col.name') },
  { key: 'type', label: t('cmp.col.type'), priority: 'medium' as const },
  { key: 'status', label: t('cmp.col.status') },
  { key: 'closes', label: t('cmp.col.closes'), priority: 'medium' as const },
  { key: 'prizes', label: t('cmp.col.prizes'), priority: 'medium' as const },
  { key: 'actions', label: t('cmp.col.actions') },
];

const matchesStatus = (c: CampaignSummary) =>
  status.value === 'all' ||
  (status.value === 'ended'
    ? c.status === 'COMPLETED' || c.status === 'CANCELLED'
    : c.status.toLowerCase() === status.value);

const filtered = computed(() =>
  items.value.filter(
    (c) =>
      matchesStatus(c) &&
      (!query.value || c.title.toLowerCase().includes(query.value.trim().toLowerCase())),
  ),
);
const rows = computed(() =>
  filtered.value.map((c) => ({
    id: c.id,
    version: c.version,
    name: c.title,
    type: c.template
      ? t(`tpl.archetype.${c.template.archetype}` as AppTextKey)
      : t('cmp.noTemplate'),
    status: c.status,
    closes: c.endAt ? formatInZone(new Date(c.endAt), zone) : t('cmp.noClose'),
    prizes: c.prizeCount,
  })),
);
const filtering = computed(() => query.value.trim() !== '' || status.value !== 'all');

const creating = ref(false);
const createNew = () =>
  attempt(async () => {
    creating.value = true;
    try {
      const created = await store.create(t('cmp.newTitle'));
      await navigateTo(`/app/campaigns/${created.id}`);
    } finally {
      creating.value = false;
    }
  });

const copy = (id: string) =>
  attempt(async () => {
    await store.duplicate(id);
    await load();
    toast.push(t('cmp.duplicated'));
  });

const togglePause = (row: { id: string; version: number; status: string }) =>
  attempt(async () => {
    const paused = row.status === 'PAUSED';
    await (paused ? store.resume(row) : store.pause(row));
    await load();
    toast.push(paused ? t('cmp.resumed') : t('cmp.paused'), 'info');
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
    toast.push(t('cmp.deleted'));
  });
</script>

<template>
  <BusinessShell current="campaigns">
    <template #search>
      <UiSearchField v-model="query" :label="t('cmp.search')" />
    </template>
    <template v-if="canManage" #actions>
      <UiButton
        size="xs"
        icon="plus"
        :loading="creating"
        :loading-label="t('cmp.creating')"
        @click="createNew"
      >
        {{ t('cmp.new') }}
      </UiButton>
    </template>

    <header class="page-head">
      <h1 class="ui-text-h1">{{ t('cmp.title') }}</h1>
      <p v-if="!canManage" class="ui-text-caption ui-text-hint">{{ t('cmp.readonly.role') }}</p>
    </header>

    <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

    <UiSystemState v-if="loadFailed" kind="generic" @action="load" />
    <section v-else class="table-card" aria-labelledby="campaigns-title">
      <div class="table-card__head">
        <h2 id="campaigns-title" class="ui-text-h3">
          {{ t('cmp.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ items.length }})</span>
        </h2>
        <UiSegmentedControl v-model="status" :label="t('cmp.filter')" :options="statusOptions" />
      </div>
      <UiDataTable
        flush
        :name="t('cmp.title')"
        :columns="columns"
        :rows="rows"
        :loading="loading"
        row-key="id"
      >
        <template #cell-name="{ row }">
          <UiLink :to="`/app/campaigns/${String(row.id)}`">{{ row.name }}</UiLink>
        </template>
        <template #cell-status="{ row }">
          <UiStatusChip vocabulary="campaign" :status="String(row.status)" />
        </template>
        <template #cell-actions="{ row }">
          <span class="actions">
            <UiButton :to="`/app/campaigns/${String(row.id)}`" variant="tertiary" size="xs">
              {{ canManage && row.status === 'DRAFT' ? t('cmp.edit') : t('cmp.view') }}
            </UiButton>
            <UiButton
              v-if="
                canOperate &&
                (row.status === 'LIVE' || row.status === 'SCHEDULED' || row.status === 'PAUSED')
              "
              variant="tertiary"
              size="xs"
              @click="
                togglePause({
                  id: String(row.id),
                  version: Number(row.version),
                  status: String(row.status),
                })
              "
            >
              {{ row.status === 'PAUSED' ? t('cmp.resume') : t('cmp.pause') }}
            </UiButton>
            <UiButton v-if="canManage" variant="tertiary" size="xs" @click="copy(String(row.id))">
              {{ t('cmp.duplicate') }}
            </UiButton>
            <UiButton
              v-if="canManage && row.status === 'DRAFT'"
              variant="tertiary"
              size="xs"
              @click="toDelete = { id: String(row.id), name: String(row.name) }"
            >
              {{ t('cmp.delete') }}
            </UiButton>
          </span>
        </template>
        <template #empty>
          <UiEmptyState
            :title="filtering ? t('cmp.noMatch.title') : t('cmp.empty.title')"
            :description="filtering ? t('cmp.noMatch.body') : t('cmp.empty.body')"
          >
            <UiButton v-if="!filtering && canManage" size="xs" icon="plus" @click="createNew">
              {{ t('cmp.new') }}
            </UiButton>
          </UiEmptyState>
        </template>
      </UiDataTable>
    </section>

    <UiConfirmDialog
      v-model:open="deleteOpen"
      variant="destructive"
      :title="t('cmp.delete.title')"
      :consequence="t('cmp.delete.consequence', { name: toDelete?.name ?? '' })"
      :confirm-label="t('cmp.delete')"
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
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}
</style>
