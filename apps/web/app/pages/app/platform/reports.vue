<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../../i18n';
import { toApiError } from '../../../modules/auth/errors';
import { browserZone } from '../../../modules/campaigns/logic';
import PlatformShell from '../../../modules/platform/components/PlatformShell.vue';
import { severityOf } from '../../../modules/platform/logic';
import type { ReportItem, ReportStatus } from '../../../modules/platform/types';
import { usePlatform } from '../../../modules/platform/usePlatform';
import { CONSOLE_PAGE_SIZE } from '../../../utils/paginate';

/**
 * Scam reports from winners (client-rendered, no-store). Worst first, with how many people have reported the
 * business and the score that adds up to. A reviewer marks each reviewed or dismissed; the first to do so wins.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('platform.reports.title') });

const platform = usePlatform();
const zone = browserZone();

const status = ref<ReportStatus>('OPEN');
const items = ref<ReportItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const loadingPage = ref(false);
const forbidden = ref(false);
const failed = ref(false);
const notice = ref('');

async function load(initial = false) {
  (initial ? loading : loadingPage).value = true;
  failed.value = false;
  try {
    if (initial) await platform.me();
    const r = await platform.reports(
      status.value,
      CONSOLE_PAGE_SIZE,
      (page.value - 1) * CONSOLE_PAGE_SIZE,
    );
    items.value = r.items;
    total.value = r.total;
  } catch (e) {
    if ((e as { status?: number }).status === 403) forbidden.value = true;
    else failed.value = true;
  } finally {
    loading.value = false;
    loadingPage.value = false;
  }
}
onMounted(() => load(true));
watch(status, () => {
  page.value = 1;
  void load();
});
watch(page, () => load());

const statusOptions = (['OPEN', 'REVIEWED', 'DISMISSED'] as const).map((s) => ({
  value: s,
  label: t(`platform.reports.status.${s}` as const),
}));
const when = (iso: string) => formatInZone(new Date(iso), zone);

async function resolve(id: string, to: 'REVIEWED' | 'DISMISSED') {
  notice.value = '';
  try {
    await platform.resolve(id, { status: to, note: '' });
    notice.value = t('platform.report.resolved');
    await load();
  } catch (e) {
    notice.value = t(
      `platform.error.${toApiError(e).status === 404 ? 'notFound' : 'generic'}` as const,
    );
  }
}

const columns = [
  { key: 'reason', label: t('platform.col.reason') },
  { key: 'reporter', label: t('platform.col.reporter'), priority: 'medium' as const },
  { key: 'business', label: t('platform.col.business') },
  { key: 'standing', label: t('platform.col.standing') },
  { key: 'reported', label: t('platform.col.reported'), priority: 'low' as const },
  { key: 'actions', label: t('platform.col.actions') },
];
const rows = computed(() =>
  items.value.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    severity: r.severity,
    reporter: r.reporterName,
    business: r.businessName,
    campaign: r.campaignTitle,
    openReports: r.businessOpenReports,
    scamScore: r.businessScamScore,
    level: severityOf(r.businessScamScore),
    reported: when(r.createdAt),
    open: r.status === 'OPEN',
  })),
);
</script>

<template>
  <PlatformShell current="reports">
    <header class="page-head">
      <h1 class="ui-text-h1">{{ t('platform.reports.title') }}</h1>
      <p class="ui-text-body ui-text-hint">{{ t('platform.reports.subtitle') }}</p>
    </header>

    <UiSystemState v-if="forbidden" kind="forbidden" />
    <UiSystemState v-else-if="failed && items.length === 0" kind="generic" @action="load(true)" />
    <UiSkeleton v-else-if="loading" variant="card" />

    <template v-else>
      <UiBanner v-if="notice" class="notice" tone="info" role="status">{{ notice }}</UiBanner>
      <section class="table-card" aria-labelledby="reports-title">
        <div class="table-card__head">
          <h2 id="reports-title" class="ui-text-h3">
            {{ t('platform.reports.title') }}
            <span class="ui-text-hint ui-text-body-s">({{ total }})</span>
          </h2>
          <UiSegmentedControl
            v-model="status"
            :label="t('platform.reports.filter')"
            :options="statusOptions"
          />
        </div>
        <UiDataTable
          flush
          :name="t('platform.reports.title')"
          :columns="columns"
          :rows="rows"
          row-key="id"
          :loading="loadingPage"
        >
          <template #foot>
            <UiPagination
              v-model:page="page"
              :total="total"
              :page-size="CONSOLE_PAGE_SIZE"
              :label="t('platform.reports.title')"
            />
          </template>
          <template #cell-reason="{ row }">
            <UiBadge
              :tone="Number(row.severity) >= 70 ? 'danger' : 'warning'"
              icon="alert-triangle"
            >
              {{ t(`rewards.report.reason.${row.reason}` as AppTextKey) }}
            </UiBadge>
            <p v-if="row.details" class="ui-text-caption ui-text-hint details">
              {{ row.details }}
            </p>
          </template>
          <template #cell-business="{ row }">
            <span class="ui-text-label">{{ row.business }}</span>
            <span class="ui-text-caption ui-text-hint block">{{ row.campaign }}</span>
          </template>
          <template #cell-standing="{ row }">
            <UiBadge :tone="row.level === 'high' ? 'danger' : 'warning'">
              {{ t('platform.scam.score', { score: Number(row.scamScore) }) }}
            </UiBadge>
            <span class="ui-text-caption ui-text-hint block">
              {{ t('platform.scam.open', { n: Number(row.openReports) }) }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <div v-if="row.open" class="actions">
              <UiButton size="xs" variant="secondary" @click="resolve(String(row.id), 'REVIEWED')">
                {{ t('platform.report.reviewed') }}
              </UiButton>
              <UiButton size="xs" variant="tertiary" @click="resolve(String(row.id), 'DISMISSED')">
                {{ t('platform.report.dismiss') }}
              </UiButton>
            </div>
          </template>
          <template #empty>
            <UiEmptyState
              :title="t('platform.reports.empty.title')"
              :description="t('platform.reports.empty.body')"
              icon="shield-check"
              :heading-level="3"
            />
          </template>
        </UiDataTable>
      </section>
    </template>
  </PlatformShell>
</template>

<style scoped>
.page-head {
  margin-block-end: var(--ui-space-8);
}
.page-head p,
.page-head h1 {
  margin: 0;
}
.notice {
  margin-block-end: var(--ui-space-6);
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
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.table-card__head h2 {
  margin: 0;
}
.block {
  display: block;
}
.details {
  margin: var(--ui-space-1) 0 0;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
