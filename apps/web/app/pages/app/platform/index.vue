<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../../i18n';
import { browserZone } from '../../../modules/campaigns/logic';
import DecisionDialog from '../../../modules/platform/components/DecisionDialog.vue';
import PlatformShell from '../../../modules/platform/components/PlatformShell.vue';
import { seenElsewhere, severityOf } from '../../../modules/platform/logic';
import type { Decision, ReviewItem } from '../../../modules/platform/types';
import { usePlatform } from '../../../modules/platform/usePlatform';
import { awardAmount, chipStatus } from '../../../modules/rewards/logic';
import { CONSOLE_PAGE_SIZE } from '../../../utils/paginate';

/**
 * Platform review of held awards (client-rendered, no-store: it holds personal data). Awards from every
 * business that the risk rules held, riskiest first, with what else is known. Release, reject or revoke needs
 * the reviewer's password again. Who may be here is decided by the API on every call.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('platform.awards.title') });

const platform = usePlatform();
const zone = browserZone();

const items = ref<ReviewItem[]>([]);
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
    const r = await platform.reviews(CONSOLE_PAGE_SIZE, (page.value - 1) * CONSOLE_PAGE_SIZE);
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
watch(page, () => load());

const when = (iso: string) => formatInZone(new Date(iso), zone);

const columns = [
  { key: 'winner', label: t('platform.col.winner') },
  { key: 'business', label: t('platform.col.business') },
  { key: 'prize', label: t('platform.col.prize'), priority: 'medium' as const },
  { key: 'status', label: t('platform.col.status') },
  { key: 'risk', label: t('platform.col.risk') },
  { key: 'waiting', label: t('platform.col.waiting'), priority: 'low' as const },
  { key: 'actions', label: t('platform.col.actions') },
];
const rows = computed(() =>
  items.value.map((i) => ({
    id: i.awardId,
    winner: i.winnerName,
    business: i.businessName,
    campaign: i.campaignTitle,
    prize: awardAmount(i) ?? i.kind,
    status: i.status,
    score: i.riskScore,
    severity: severityOf(i.riskScore),
    reasons: i.riskReasons,
    destinationElsewhere: i.crossBusiness.destinationBusinesses,
    networkElsewhere: i.crossBusiness.networkBusinesses,
    elsewhere: seenElsewhere(i.crossBusiness),
    waiting: when(i.createdAt),
  })),
);

// ---- deciding
const deciding = ref<ReviewItem | null>(null);
const decision = ref<Decision>('release');
const dialog = ref(false);
function decide(id: string, d: Decision) {
  deciding.value = items.value.find((i) => i.awardId === id) ?? null;
  decision.value = d;
  dialog.value = deciding.value !== null;
}
async function submit(
  awardId: string,
  input: { decision: Decision; note: string; password: string },
) {
  await platform.decide(awardId, input);
  notice.value = t('platform.decided');
  await load();
}
</script>

<template>
  <PlatformShell current="awards">
    <header class="page-head">
      <h1 class="ui-text-h1">{{ t('platform.awards.title') }}</h1>
      <p class="ui-text-body ui-text-hint">{{ t('platform.awards.subtitle') }}</p>
    </header>

    <UiSystemState v-if="forbidden" kind="forbidden" />
    <UiSystemState v-else-if="failed && items.length === 0" kind="generic" @action="load(true)" />
    <UiSkeleton v-else-if="loading" variant="card" />

    <template v-else>
      <UiBanner v-if="notice" class="notice" tone="info" role="status">{{ notice }}</UiBanner>
      <section class="table-card" aria-labelledby="queue-title">
        <h2 id="queue-title" class="ui-text-h3 table-card__head">
          {{ t('platform.awards.title') }}
          <span class="ui-text-hint ui-text-body-s">({{ total }})</span>
        </h2>
        <UiDataTable
          flush
          :name="t('platform.awards.title')"
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
              :label="t('platform.awards.title')"
            />
          </template>
          <template #cell-winner="{ row }">
            <strong class="ui-text-label">{{ row.winner }}</strong>
          </template>
          <template #cell-business="{ row }">
            <span class="ui-text-label">{{ row.business }}</span>
            <span class="ui-text-caption ui-text-hint block">{{ row.campaign }}</span>
          </template>
          <template #cell-status="{ row }">
            <UiStatusChip vocabulary="rewardUnit" :status="chipStatus(String(row.status))" />
          </template>
          <template #cell-risk="{ row }">
            <UiBadge :tone="row.severity === 'high' ? 'danger' : 'warning'" icon="alert-triangle">
              {{ t('platform.risk.score', { score: Number(row.score) }) }}
            </UiBadge>
            <ul class="reasons ui-text-caption ui-text-hint">
              <li v-for="code in row.reasons as string[]" :key="code">
                {{ t(`rewards.biz.risk.rule.${code}` as AppTextKey) }}
              </li>
              <li v-if="row.elsewhere && Number(row.destinationElsewhere) > 0">
                {{ t('platform.elsewhere.destination', { n: Number(row.destinationElsewhere) }) }}
              </li>
              <li v-if="row.elsewhere && Number(row.networkElsewhere) > 0">
                {{ t('platform.elsewhere.network', { n: Number(row.networkElsewhere) }) }}
              </li>
            </ul>
          </template>
          <template #cell-actions="{ row }">
            <div class="actions">
              <UiButton size="xs" variant="secondary" @click="decide(String(row.id), 'release')">
                {{ t('platform.action.release') }}
                <span class="ui-sr-only">{{
                  t('platform.action.for', {
                    action: t('platform.action.release'),
                    winner: String(row.winner),
                  })
                }}</span>
              </UiButton>
              <UiButton size="xs" variant="danger" @click="decide(String(row.id), 'reject')">
                {{ t('platform.action.reject') }}
                <span class="ui-sr-only">{{
                  t('platform.action.for', {
                    action: t('platform.action.reject'),
                    winner: String(row.winner),
                  })
                }}</span>
              </UiButton>
              <UiButton size="xs" variant="tertiary" @click="decide(String(row.id), 'revoke')">
                {{ t('platform.action.revoke') }}
                <span class="ui-sr-only">{{
                  t('platform.action.for', {
                    action: t('platform.action.revoke'),
                    winner: String(row.winner),
                  })
                }}</span>
              </UiButton>
            </div>
          </template>
          <template #empty>
            <UiEmptyState
              :title="t('platform.awards.empty.title')"
              :description="t('platform.awards.empty.body')"
              icon="shield-check"
              :heading-level="3"
            />
          </template>
        </UiDataTable>
      </section>
    </template>

    <DecisionDialog v-model:open="dialog" :item="deciding" :decision="decision" :submit="submit" />
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
  margin: 0;
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.block {
  display: block;
}
.reasons {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: var(--ui-space-1) 0 0;
  padding: 0;
  list-style: none;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
