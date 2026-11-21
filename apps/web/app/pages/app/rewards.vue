<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { t, type AppTextKey } from '../../i18n';
import { toApiError } from '../../modules/auth/errors';
import BusinessShell from '../../modules/business/components/BusinessShell.vue';
import { useCampaigns } from '../../modules/campaigns/useCampaigns';
import type { CampaignSummary } from '../../modules/campaigns/types';
import {
  canSettle,
  countAwards,
  canRecall,
  needsPayment,
  needsPlatform,
  riskBand,
  waitsForReview,
} from '../../modules/rewards/businessLogic';
import PayoutDialog from '../../modules/rewards/components/PayoutDialog.vue';
import RejectDialog from '../../modules/rewards/components/RejectDialog.vue';
import { payoutErrorKey } from '../../modules/rewards/errors';
import { awardAmount, chipStatus } from '../../modules/rewards/logic';
import type { BusinessAward, RejectReason } from '../../modules/rewards/types';
import { useBusinessRewards } from '../../modules/rewards/useBusinessRewards';
import { downloadText } from '../../utils/download';

/**
 * Business rewards (client-rendered, no-store: it holds personal data). Pick a finished campaign, settle its
 * winners once, see where each award stands, send claimed cash and items and record the payment, and export
 * the list. Every rule is enforced by the API (role, one settlement, one payment); this page asks and reports.
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('rewards.biz.title') });

const rewards = useBusinessRewards();
const campaigns = useCampaigns();

const choices = ref<CampaignSummary[]>([]);
const campaignId = ref('');
const awards = ref<BusinessAward[]>([]);
const loading = ref(true);
const loadingAwards = ref(false);
const failed = ref(false);
const settling = ref(false);
const notice = ref<{ tone: 'info' | 'error'; text: string } | null>(null);
const now = new Date();

const campaign = computed(() => choices.value.find((c) => c.id === campaignId.value) ?? null);
const counts = computed(() => countAwards(awards.value));
const settleable = computed(
  () => campaign.value !== null && canSettle(campaign.value, awards.value.length, now),
);
const options = computed(() => [
  { value: '', label: t('rewards.biz.campaign.choose') },
  ...choices.value.map((c) => ({ value: c.id, label: c.title })),
]);

const fail = (e: unknown) => {
  notice.value = { tone: 'error', text: t(payoutErrorKey(toApiError(e))) };
};

async function loadAwards() {
  awards.value = [];
  if (!campaignId.value) return;
  loadingAwards.value = true;
  try {
    awards.value = await rewards.awards(campaignId.value);
  } catch (e) {
    fail(e);
  } finally {
    loadingAwards.value = false;
  }
}

onMounted(async () => {
  if (!rewards.canManage.value) {
    loading.value = false;
    return;
  }
  try {
    // A draft has nothing to settle.
    choices.value = (await campaigns.list()).filter((c) => c.status !== 'DRAFT');
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
});
watch(campaignId, () => {
  notice.value = null;
  void loadAwards();
});

async function settle() {
  notice.value = null;
  settling.value = true;
  try {
    const r = await rewards.settle(campaignId.value);
    notice.value = { tone: 'info', text: t('rewards.biz.settled', { n: r.awarded }) };
    await loadAwards();
  } catch (e) {
    fail(e);
  } finally {
    settling.value = false;
  }
}

async function exportList() {
  notice.value = null;
  try {
    downloadText(`awards-${campaignId.value}.csv`, await rewards.exportCsv(campaignId.value));
    notice.value = { tone: 'info', text: t('rewards.biz.exported') };
  } catch (e) {
    fail(e);
  }
}

// ---- paying one award
const paying = ref<BusinessAward | null>(null);
const dialog = ref(false);
function pay(id: string) {
  paying.value = awards.value.find((a) => a.id === id) ?? null;
  dialog.value = paying.value !== null;
}
const reveal = (awardId: string) => rewards.destination(awardId);
async function record(awardId: string, reference: string) {
  const r = await rewards.fulfil(awardId, reference);
  notice.value = {
    tone: 'info',
    text: r.alreadyPaid
      ? t('rewards.biz.paid.already')
      : t('rewards.biz.paid', { reference: r.reference ?? reference }),
  };
  await loadAwards();
}

// ---- reviewing an award the risk rules held
async function release(id: string) {
  notice.value = null;
  try {
    await rewards.review(id, 'release');
    notice.value = { tone: 'info', text: t('rewards.biz.released') };
    await loadAwards();
  } catch (e) {
    fail(e);
  }
}
const rejecting = ref<BusinessAward | null>(null);
const rejectMode = ref<'reject' | 'revoke'>('reject');
const rejectOpen = ref(false);
function askReject(id: string, mode: 'reject' | 'revoke' = 'reject') {
  rejecting.value = awards.value.find((a) => a.id === id) ?? null;
  rejectMode.value = mode;
  rejectOpen.value = rejecting.value !== null;
}
async function reject(awardId: string, reason: RejectReason) {
  await rewards.review(awardId, rejectMode.value, reason);
  notice.value = {
    tone: 'info',
    text: t(rejectMode.value === 'revoke' ? 'rewards.biz.revoked' : 'rewards.biz.rejected'),
  };
  await loadAwards();
}

const columns = [
  { key: 'place', label: t('rewards.biz.col.place'), priority: 'low' as const },
  { key: 'winner', label: t('rewards.biz.col.winner') },
  { key: 'prize', label: t('rewards.biz.col.prize') },
  { key: 'status', label: t('rewards.biz.col.status') },
  { key: 'risk', label: t('rewards.biz.col.risk'), priority: 'medium' as const },
  { key: 'sentTo', label: t('rewards.biz.col.sentTo'), priority: 'medium' as const },
  { key: 'actions', label: t('rewards.biz.col.actions') },
];
const tableRows = computed(() =>
  awards.value.map((a) => ({
    id: a.id,
    place: a.rank ?? t('rewards.biz.places.none'),
    winner: a.name,
    prize: awardAmount(a) ?? a.kind,
    status: a.status,
    sentTo: a.paidReference ?? a.payoutHint ?? '-',
    payable: needsPayment(a),
    recallable: canRecall(a),
    waiting: waitsForReview(a),
    platform: needsPlatform(a),
    score: a.riskScore,
    band: riskBand(a.riskScore),
    reasons: a.riskReasons,
  })),
);
</script>

<template>
  <BusinessShell current="rewards">
    <header class="page-head">
      <div>
        <h1 class="ui-text-h1 page-head__title">{{ t('rewards.biz.title') }}</h1>
        <p class="ui-text-body ui-text-hint">{{ t('rewards.biz.subtitle') }}</p>
      </div>
    </header>

    <UiSystemState v-if="!rewards.canManage.value" kind="forbidden" />
    <UiSystemState v-else-if="failed" kind="generic" />
    <UiSkeleton v-else-if="loading" variant="card" />

    <UiEmptyState
      v-else-if="choices.length === 0"
      :title="t('rewards.biz.none.title')"
      :description="t('rewards.biz.none.body')"
      icon="gift"
    >
      <UiButton to="/app/campaigns" variant="secondary" size="xs">
        {{ t('rewards.biz.none.action') }}
      </UiButton>
    </UiEmptyState>

    <template v-else>
      <div class="picker">
        <UiSelect
          id="rewards-campaign"
          v-model="campaignId"
          :label="t('rewards.biz.campaign')"
          :options="options"
        />
      </div>

      <UiBanner
        v-if="notice"
        class="notice"
        :tone="notice.tone"
        :role="notice.tone === 'error' ? 'alert' : 'status'"
      >
        {{ notice.text }}
      </UiBanner>

      <UiEmptyState
        v-if="!campaignId"
        :title="t('rewards.biz.pick.title')"
        :description="t('rewards.biz.pick.body')"
        icon="gift"
      />

      <template v-else>
        <section class="stats" :aria-label="t('rewards.biz.title')">
          <UiStatCard :label="t('rewards.biz.stat.total')" :value="String(counts.total)" />
          <UiStatCard :label="t('rewards.biz.stat.toPay')" :value="String(counts.toPay)" />
          <UiStatCard
            :label="t('rewards.biz.stat.paid')"
            :value="String(counts.paid)"
            icon="check-circle"
            icon-tone="success"
          />
          <UiStatCard :label="t('rewards.biz.stat.unclaimed')" :value="String(counts.unclaimed)" />
          <UiStatCard :label="t('rewards.biz.stat.held')" :value="String(counts.held)" />
        </section>

        <section class="block table-card" aria-labelledby="winners-title">
          <div class="block__head">
            <h2 id="winners-title" class="ui-text-h3">
              {{ t('rewards.biz.stat.total') }}
              <span class="ui-text-hint ui-text-body-s">({{ awards.length }})</span>
            </h2>
            <div class="actions">
              <UiButton
                v-if="settleable"
                size="xs"
                icon="trophy"
                :loading="settling"
                :loading-label="t('rewards.biz.settle.loading')"
                @click="settle"
              >
                {{ t('rewards.biz.settle') }}
              </UiButton>
              <UiButton
                v-if="awards.length > 0"
                variant="secondary"
                size="xs"
                icon="download"
                @click="exportList"
              >
                {{ t('rewards.biz.export') }}
              </UiButton>
            </div>
          </div>
          <p v-if="settleable" class="ui-text-caption ui-text-hint hint">
            {{ t('rewards.biz.settle.hint') }}
          </p>
          <UiDataTable
            flush
            :name="t('rewards.biz.stat.total')"
            :columns="columns"
            :rows="tableRows"
            row-key="id"
            :loading="loadingAwards"
          >
            <template #cell-winner="{ row }">
              <strong class="ui-text-label">{{ row.winner }}</strong>
            </template>
            <template #cell-status="{ row }">
              <UiStatusChip vocabulary="rewardUnit" :status="chipStatus(String(row.status))" />
            </template>
            <template #cell-risk="{ row }">
              <template v-if="row.band !== 'none'">
                <UiBadge :tone="row.band === 'FLAG' ? 'danger' : 'warning'" icon="alert-triangle">
                  {{ t(row.band === 'FLAG' ? 'rewards.biz.risk.FLAG' : 'rewards.biz.risk.REVIEW') }}
                </UiBadge>
                <ul class="reasons ui-text-caption ui-text-hint">
                  <li v-for="code in row.reasons as string[]" :key="code">
                    {{ t(`rewards.biz.risk.rule.${code}` as AppTextKey) }}
                  </li>
                </ul>
              </template>
              <span v-else class="ui-text-hint">{{ t('rewards.biz.risk.none') }}</span>
            </template>
            <template #cell-actions="{ row }">
              <div v-if="row.waiting" class="review">
                <UiButton
                  size="xs"
                  variant="secondary"
                  :disabled="Boolean(row.platform)"
                  :disabled-reason="row.platform ? t('rewards.biz.release.platform') : undefined"
                  @click="release(String(row.id))"
                >
                  {{ t('rewards.biz.release') }}
                  <span class="ui-sr-only">{{
                    t('rewards.biz.release.for', { name: String(row.winner) })
                  }}</span>
                </UiButton>
                <UiButton size="xs" variant="danger" @click="askReject(String(row.id))">
                  {{ t('rewards.biz.reject') }}
                  <span class="ui-sr-only">{{
                    t('rewards.biz.reject.for', { name: String(row.winner) })
                  }}</span>
                </UiButton>
              </div>
              <UiButton
                v-if="row.recallable"
                size="xs"
                variant="tertiary"
                @click="askReject(String(row.id), 'revoke')"
              >
                {{ t('rewards.biz.revoke') }}
                <span class="ui-sr-only">{{
                  t('rewards.biz.revoke.for', { name: String(row.winner) })
                }}</span>
              </UiButton>
              <UiButton
                v-if="row.payable"
                size="xs"
                variant="secondary"
                @click="pay(String(row.id))"
              >
                {{ t('rewards.biz.pay') }}
                <span class="ui-sr-only">{{
                  t('rewards.biz.pay.for', { name: String(row.winner) })
                }}</span>
              </UiButton>
            </template>
            <template #empty>
              <UiEmptyState
                :title="t('rewards.biz.empty.title')"
                :description="t('rewards.biz.empty.body')"
                icon="gift"
                :heading-level="3"
              />
            </template>
          </UiDataTable>
        </section>
      </template>
    </template>

    <PayoutDialog v-model:open="dialog" :award="paying" :reveal="reveal" :submit="record" />
    <RejectDialog
      v-model:open="rejectOpen"
      :award="rejecting"
      :mode="rejectMode"
      :submit="reject"
    />
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
.picker {
  max-inline-size: 28rem;
  margin-block-end: var(--ui-space-6);
}
.notice {
  margin-block-end: var(--ui-space-6);
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.block {
  display: flex;
  flex-direction: column;
  margin-block-end: var(--ui-space-8);
}
.table-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
}
.table-card .block__head {
  padding: var(--ui-space-5) var(--ui-space-6);
  border-block-end: 1px solid var(--ui-color-border);
}
.block h2 {
  margin: 0;
}
.block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.hint {
  margin: 0;
  padding: var(--ui-space-3) var(--ui-space-6);
}
.reasons {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: var(--ui-space-1) 0 0;
  padding: 0;
  list-style: none;
}
.review {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
@media (min-width: 768px) {
  .stats {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
