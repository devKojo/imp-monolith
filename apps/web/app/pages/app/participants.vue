<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../i18n';
import BusinessShell from '../../modules/business/components/BusinessShell.vue';
import { browserZone } from '../../modules/campaigns/logic';
import ParticipationSummaryDialog from '../../modules/participants/components/ParticipationSummaryDialog.vue';
import { campaignChoices, completionPercent } from '../../modules/participants/logic';
import type {
  ParticipantSummary,
  Participation,
  ParticipationFilter,
} from '../../modules/participants/types';
import { useParticipants } from '../../modules/participants/useParticipants';
import { CONSOLE_PAGE_SIZE } from '../../utils/paginate';

/**
 * Participants (client-rendered, no-store: personal data never passes the SSR tier). Who took part in
 * the business's quizzes and surveys and how far they got. Only a name is shown, never an email or an
 * answer. The counts and the list are real, read from the participants API; the role is checked there.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('participants.title') });

const store = useParticipants();
const zone = browserZone();

const summary = ref<ParticipantSummary | null>(null);
const rows = ref<Participation[]>([]);
const total = ref(0);
const loading = ref(true);
const loadingPage = ref(false);
const page = ref(1);
const failed = ref(false);
const filter = ref<ParticipationFilter>({ campaignId: '', status: 'all' });

async function loadSummary() {
  summary.value = await store.summary();
}
async function loadRows() {
  const result = await store.list(
    filter.value,
    (page.value - 1) * CONSOLE_PAGE_SIZE,
    CONSOLE_PAGE_SIZE,
  );
  rows.value = result.items;
  total.value = result.total;
}
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    await Promise.all([loadSummary(), loadRows()]);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  if (store.canView.value) void load();
  else loading.value = false;
});

// A new filter starts the list again from the first page; the counts above do not depend on it. Both
// changes land in the same tick, so one request is made. The page that was open is kept when only the page
// changes.
watch(filter, () => (page.value = 1));
watch([filter, page], async () => {
  if (loading.value) return;
  loadingPage.value = true;
  failed.value = false;
  try {
    await loadRows();
  } catch {
    failed.value = true;
  } finally {
    loadingPage.value = false;
  }
});

const campaignOptions = computed(() =>
  campaignChoices(summary.value?.campaigns ?? [], t('participants.filter.allCampaigns')),
);
const statusOptions = [
  { value: 'all', label: t('participants.filter.all') },
  { value: 'in_progress', label: t('participants.status.in_progress') },
  { value: 'completed', label: t('participants.status.completed') },
];
const campaignId = computed({
  get: () => filter.value.campaignId,
  set: (v: string) => (filter.value = { ...filter.value, campaignId: v }),
});
const status = computed({
  get: () => filter.value.status as string,
  set: (v: string) =>
    (filter.value = { ...filter.value, status: v as ParticipationFilter['status'] }),
});
const filtering = computed(() => filter.value.campaignId !== '' || filter.value.status !== 'all');

const typeLabel = (kind: string) => t(`tpl.archetype.${kind}` as AppTextKey);
const when = (iso: string | null) => (iso ? formatInZone(new Date(iso), zone) : '-');

const columns = [
  { key: 'name', label: t('participants.col.name') },
  { key: 'campaign', label: t('participants.col.campaign') },
  { key: 'type', label: t('participants.col.type'), priority: 'low' as const },
  { key: 'status', label: t('participants.col.status') },
  { key: 'startedAt', label: t('participants.col.started'), priority: 'medium' as const },
  { key: 'finishedAt', label: t('participants.col.finished'), priority: 'low' as const },
  { key: 'actions', label: t('participants.col.actions') },
];
const tableRows = computed(() =>
  rows.value.map((r) => ({
    id: r.id,
    name: r.name,
    campaign: r.campaignTitle,
    type: typeLabel(r.kind),
    status: r.status,
    attempt: r.attempt,
    result: r.result,
    startedAt: when(r.startedAt),
    finishedAt: when(r.completedAt),
  })),
);
// ---- the summary of one participation
const viewing = ref<Participation | null>(null);
const summaryOpen = ref(false);
function view(id: string) {
  viewing.value = rows.value.find((r) => r.id === id) ?? null;
  summaryOpen.value = viewing.value !== null;
}

const done = computed(() => summary.value?.completed ?? 0);
const started = computed(() => summary.value?.started ?? 0);
</script>

<template>
  <BusinessShell current="participants">
    <header class="page-head">
      <div>
        <h1 class="ui-text-h1 page-head__title">{{ t('participants.title') }}</h1>
        <p class="ui-text-body ui-text-hint">{{ t('participants.subtitle') }}</p>
      </div>
    </header>

    <UiSystemState v-if="!store.canView.value" kind="forbidden" />
    <UiSystemState v-else-if="failed && !summary" kind="generic" @action="load" />
    <UiSkeleton v-else-if="loading" variant="card" />

    <template v-else>
      <section class="stats" :aria-label="t('participants.stats.label')">
        <UiStatCard
          :label="t('participants.stat.people')"
          :value="String(summary?.participants ?? 0)"
          icon="users"
        />
        <UiStatCard :label="t('participants.stat.started')" :value="String(started)" />
        <UiStatCard
          :label="t('participants.stat.completed')"
          :value="String(done)"
          :suffix="t('participants.stat.completed.suffix', { n: completionPercent(started, done) })"
          icon="check-circle"
          icon-tone="success"
        />
      </section>

      <UiEmptyState
        v-if="(summary?.campaigns.length ?? 0) === 0"
        :title="t('participants.empty.title')"
        :description="t('participants.empty.body')"
      >
        <UiButton to="/app/campaigns" variant="secondary" size="xs">
          {{ t('participants.empty.action') }}
        </UiButton>
      </UiEmptyState>

      <section v-else class="block" aria-labelledby="everyone">
        <div class="block__head">
          <h2 id="everyone" class="ui-text-h3">
            {{ t('participants.list.title') }}
            <span class="ui-text-hint ui-text-body-s">({{ total }})</span>
          </h2>
          <div class="filters">
            <UiSelect
              v-model="campaignId"
              :label="t('participants.filter.campaign')"
              :options="campaignOptions"
            />
            <UiSegmentedControl
              v-model="status"
              :label="t('participants.filter.status')"
              :options="statusOptions"
            />
          </div>
        </div>
        <UiBanner v-if="failed" tone="error" role="alert">{{ t('participants.error') }}</UiBanner>
        <UiDataTable
          :name="t('participants.list.title')"
          :columns="columns"
          :rows="tableRows"
          row-key="id"
          :loading="loadingPage"
        >
          <template #foot>
            <UiPagination
              v-model:page="page"
              :total="total"
              :page-size="CONSOLE_PAGE_SIZE"
              :label="t('participants.list.title')"
            />
          </template>
          <template #cell-name="{ row }">
            <strong class="ui-text-label">{{ row.name }}</strong>
          </template>
          <template #cell-status="{ row }">
            <UiBadge
              :tone="row.status === 'completed' ? 'success' : 'info'"
              :icon="row.status === 'completed' ? 'check-circle' : 'clock'"
            >
              {{ t(`participants.status.${row.status}` as AppTextKey) }}
            </UiBadge>
            <span v-if="Number(row.attempt) > 1" class="ui-text-caption ui-text-hint result">
              {{ t('participants.attempt', { n: Number(row.attempt) }) }}
            </span>
            <span v-if="row.result" class="ui-text-caption ui-text-hint result">
              {{
                t('participants.result', {
                  score: (row.result as { score: number }).score,
                  total: (row.result as { total: number }).total,
                })
              }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <UiActionMenu
              :label="t('participants.actions.for', { name: String(row.name) })"
              :items="[{ id: 'view', label: t('participants.view'), icon: 'eye' }]"
              @select="view(String(row.id))"
            />
          </template>
          <template #empty>
            <UiEmptyState
              v-if="filtering"
              :title="t('participants.filtered.title')"
              :description="t('participants.filtered.body')"
            />
            <UiEmptyState
              v-else
              :title="t('participants.empty.title')"
              :description="t('participants.empty.body')"
            />
          </template>
        </UiDataTable>
      </section>
    </template>

    <ParticipationSummaryDialog v-model:open="summaryOpen" :participation="viewing" />
  </BusinessShell>
</template>

<style scoped>
.page-head {
  margin-block-end: var(--ui-space-8);
}
.page-head p,
.page-head h1 {
  margin: 0;
}
.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.block h2 {
  margin: 0;
}
.block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--ui-space-3);
}
.result {
  margin-inline-start: var(--ui-space-2);
}
@media (min-width: 768px) {
  .stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
