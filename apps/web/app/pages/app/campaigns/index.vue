<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { useToast } from '@imp/ui/app/composables/useToast';
import type { ActionItem } from '@imp/ui/app/components/UiActionMenu.vue';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import BusinessShell from '../../../modules/business/components/BusinessShell.vue';
import { campaignErrorKey } from '../../../modules/campaigns/errors';
import { browserZone, isArchivable } from '../../../modules/campaigns/logic';
import ShareCampaign from '../../../modules/campaigns/components/ShareCampaign.vue';
import { isPublicNow, pagePath } from '../../../modules/campaigns/publicPage';
import type { CampaignSummary } from '../../../modules/campaigns/types';
import { useCampaigns } from '../../../modules/campaigns/useCampaigns';
import { CONSOLE_PAGE_SIZE, pageSlice } from '../../../utils/paginate';

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

const query = ref('');
const status = ref('all');
// Archived campaigns are kept apart from the rest: choosing that filter loads them instead.
const showArchived = computed(() => status.value === 'archived');
const items = ref<CampaignSummary[]>([]);
const loading = ref(true);
const loadFailed = ref(false);

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    items.value = await store.list(showArchived.value);
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
// Switching to or from the archived view needs the other list from the server.
watch(showArchived, () => void load());

async function attempt(action: () => Promise<void>) {
  try {
    await action();
  } catch (e) {
    toast.push(t(campaignErrorKey(toApiError(e))), 'error');
  }
}

const statusOptions = [
  { value: 'all', label: t('cmp.filter.all') },
  { value: 'draft', label: t('cmp.filter.draft') },
  { value: 'scheduled', label: t('cmp.filter.scheduled') },
  { value: 'live', label: t('cmp.filter.live') },
  { value: 'paused', label: t('cmp.filter.paused') },
  { value: 'ended', label: t('cmp.filter.ended') },
  { value: 'archived', label: t('cmp.filter.archived') },
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
  status.value === 'archived' ||
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
    slug: isPublicNow(c, new Date()) ? c.slug : null,
    archived: c.archivedAt !== null,
    archivable: isArchivable(c.status),
    closes: c.endAt ? formatInZone(new Date(c.endAt), zone) : t('cmp.noClose'),
    prizes: c.prizeCount,
  })),
);
const page = ref(1);
const pageRows = computed(() => pageSlice(rows.value, page.value));
watch([query, status], () => (page.value = 1));
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

const archive = (row: { id: string; version: number }) =>
  attempt(async () => {
    await store.archive(row);
    await load();
    toast.push(t('cmp.archivedDone'), 'info');
  });
const unarchive = (row: { id: string; version: number }) =>
  attempt(async () => {
    await store.unarchive(row);
    await load();
    toast.push(t('cmp.unarchivedDone'), 'info');
  });

type Row = (typeof rows.value)[number];

/** The actions of one row, as the menu lists them: links first, then what changes the campaign. */
function menuItems(cell: Record<string, unknown>): ActionItem[] {
  const row = cell as Row;
  const live = row.status === 'LIVE' || row.status === 'SCHEDULED' || row.status === 'PAUSED';
  const editable = canManage && row.status === 'DRAFT' && !row.archived;
  return [
    {
      id: 'open',
      label: editable ? t('cmp.edit') : t('cmp.view'),
      icon: editable ? 'pencil' : 'eye',
      to: `/app/campaigns/${row.id}`,
    },
    ...(row.slug
      ? [
          {
            id: 'page',
            label: t('cmp.viewPage'),
            icon: 'external' as const,
            to: pagePath(row.slug),
          },
          { id: 'share', label: t('cmp.share'), icon: 'share' as const },
        ]
      : []),
    ...(canOperate && live
      ? [
          {
            id: 'pause',
            label: row.status === 'PAUSED' ? t('cmp.resume') : t('cmp.pause'),
            icon: (row.status === 'PAUSED' ? 'zap' : 'pause') as 'zap' | 'pause',
          },
        ]
      : []),
    ...(canManage ? [{ id: 'duplicate', label: t('cmp.duplicate'), icon: 'copy' as const }] : []),
    ...(canManage && row.archived
      ? [{ id: 'unarchive', label: t('cmp.unarchive'), icon: 'refresh' as const }]
      : canManage && row.archivable
        ? [{ id: 'archive', label: t('cmp.archive'), icon: 'box' as const }]
        : []),
    ...(canManage && row.status === 'DRAFT'
      ? [
          {
            id: 'delete',
            label: t('cmp.delete'),
            icon: 'trash' as const,
            tone: 'danger' as const,
            separatorBefore: true,
          },
        ]
      : []),
  ];
}

// One share dialog for the whole table, opened by the "Share link" item of a row.
const sharing = ref<{ slug: string; title: string } | null>(null);
const shareOpen = ref(false);

function onAction(id: string, cell: Record<string, unknown>) {
  const row = cell as Row;
  const ref = { id: row.id, version: row.version };
  if (id === 'share' && row.slug) {
    sharing.value = { slug: row.slug, title: row.name };
    shareOpen.value = true;
  } else if (id === 'pause') void togglePause({ ...ref, status: row.status });
  else if (id === 'duplicate') void copy(row.id);
  else if (id === 'archive') void archive(ref);
  else if (id === 'unarchive') void unarchive(ref);
  else if (id === 'delete') toDelete.value = { id: row.id, name: row.name };
}

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


    <UiSystemState v-if="loadFailed" kind="generic" @action="load" />
    <section v-else class="table-card" aria-labelledby="campaigns-title">
      <div class="table-card__head">
        <h2 id="campaigns-title" class="ui-text-h3">
          {{ t('cmp.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ items.length }})</span>
        </h2>
        <UiSegmentedControl v-model="status" :label="t('cmp.filter')" :options="statusOptions" />
      </div>
      <div class="table-card__search">
        <UiSearchField v-model="query" compact :label="t('cmp.search')" />
      </div>
      <UiDataTable
        flush
        :name="t('cmp.title')"
        :columns="columns"
        :rows="pageRows"
        :loading="loading"
        row-key="id"
      >
        <template #foot>
          <UiPagination
            v-model:page="page"
            :total="rows.length"
            :page-size="CONSOLE_PAGE_SIZE"
            :label="t('cmp.title')"
          />
        </template>
        <template #cell-name="{ row }">
          <UiLink :to="`/app/campaigns/${String(row.id)}`">{{ row.name }}</UiLink>
        </template>
        <template #cell-status="{ row }">
          <UiStatusChip vocabulary="campaign" :status="String(row.status)" />
        </template>
        <template #cell-actions="{ row }">
          <UiActionMenu
            :label="t('cmp.actions.for', { name: String(row.name) })"
            :items="menuItems(row)"
            @select="(id) => onAction(id, row)"
          />
        </template>
        <template #empty>
          <UiEmptyState
            :title="
              showArchived
                ? t('cmp.archived.empty.title')
                : filtering
                  ? t('cmp.noMatch.title')
                  : t('cmp.empty.title')
            "
            :description="
              showArchived
                ? t('cmp.archived.empty.body')
                : filtering
                  ? t('cmp.noMatch.body')
                  : t('cmp.empty.body')
            "
          >
            <UiButton
              v-if="!filtering && canManage && !showArchived"
              size="xs"
              icon="plus"
              @click="createNew"
            >
              {{ t('cmp.new') }}
            </UiButton>
          </UiEmptyState>
        </template>
      </UiDataTable>
    </section>

    <ShareCampaign
      v-if="sharing"
      v-model:open="shareOpen"
      :slug="sharing.slug"
      :title="sharing.title"
      :trigger="false"
    />

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
.table-card__search {
  padding: var(--ui-space-2) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}
</style>
