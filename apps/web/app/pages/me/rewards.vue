<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import { toApiError } from '../../modules/auth/errors';
import ParticipantShell from '../../modules/participant/components/ParticipantShell.vue';
import ClaimDialog from '../../modules/rewards/components/ClaimDialog.vue';
import ReportDialog from '../../modules/rewards/components/ReportDialog.vue';
import { claimErrorKey } from '../../modules/rewards/errors';
import { awardAmount, chipStatus, daysLeft, section } from '../../modules/rewards/logic';
import type { ClaimInput, MyAward, ReportInput } from '../../modules/rewards/types';
import { useMyRewards } from '../../modules/rewards/useMyRewards';

/**
 * Participant rewards (client-rendered, no-store): what has been won, what can be claimed, and the points
 * wallet. Points are claimed in one step; money and items open a dialog for where to send them. Every
 * rule is enforced by the API; this page only asks and reports.
 */
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });
useHead({ title: t('rewards.title') });

const rewards = useMyRewards();
const awards = computed(() => rewards.awards.data.value.items);
const available = computed(() => awards.value.filter((a) => section(a) === 'available'));
const history = computed(() => awards.value.filter((a) => section(a) === 'history'));
const wallet = computed(() => rewards.wallet.data.value);
const loading = computed(() => rewards.awards.pending.value && awards.value.length === 0);
const failed = computed(() => !!rewards.awards.error.value);

const claiming = ref<MyAward | null>(null);
const dialog = ref(false);
const busy = ref<string | null>(null);
const notice = ref<{ tone: 'success' | 'error'; text: string } | null>(null);
const now = new Date();

const dateOf = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));

function deadline(a: MyAward): string | null {
  const days = daysLeft(a.claimBy, now);
  if (days === null) return null;
  return days === 1 ? t('rewards.award.dayLeft') : t('rewards.award.daysLeft', { n: days });
}

async function done(a: MyAward, input: ClaimInput) {
  const r = await rewards.claim(a.id, input);
  await rewards.refresh();
  notice.value = {
    tone: 'success',
    text: r.alreadyClaimed
      ? t('rewards.claimed.already')
      : r.status === 'HELD'
        ? t('rewards.claimed.held')
        : a.kind === 'POINTS'
          ? t('rewards.claimed.points')
          : t('rewards.claimed.sent', { business: a.businessName, hint: r.claimHint ?? '' }),
  };
}

/** Held for a routine check, before or after it was claimed. The reason is never shown. */
const checking = (a: MyAward) => a.status === 'PENDING_REVIEW' || a.status === 'HELD';

// ---- reporting a problem
const reporting = ref<MyAward | null>(null);
const reportOpen = ref(false);
function startReport(a: MyAward) {
  notice.value = null;
  reporting.value = a;
  reportOpen.value = true;
}
const sendReport = async (input: ReportInput) => {
  if (!reporting.value) return;
  await rewards.report(reporting.value.id, input);
  notice.value = { tone: 'success', text: t('rewards.report.sent') };
};

/** Points are claimed straight away; money and items ask where to send them first. */
async function start(a: MyAward) {
  notice.value = null;
  if (a.needsDestination) {
    claiming.value = a;
    dialog.value = true;
    return;
  }
  busy.value = a.id;
  try {
    await done(a, {});
  } catch (e) {
    notice.value = { tone: 'error', text: t(claimErrorKey(toApiError(e))) };
  } finally {
    busy.value = null;
  }
}

const submitClaim = async (input: ClaimInput) => {
  if (claiming.value) await done(claiming.value, input);
};

// Arriving from a result screen ("Claim reward") goes straight into claiming that award, once.
const wanted = String(useRoute().query.claim ?? '');
const opened = ref(false);
watch(
  awards,
  (list) => {
    if (opened.value || !wanted) return;
    const a = list.find((x) => x.id === wanted && x.status === 'AVAILABLE');
    if (!a) return;
    opened.value = true;
    void start(a);
  },
  { immediate: true },
);
</script>

<template>
  <ParticipantShell current="rewards">
    <header class="head">
      <h1 class="head__title">{{ t('rewards.title') }}</h1>
      <p class="head__summary ui-text-body-l">{{ t('rewards.summary') }}</p>
    </header>

    <UiBanner
      v-if="notice"
      :tone="notice.tone === 'success' ? 'info' : 'error'"
      :title="notice.tone === 'success' ? t('rewards.claimed.title.banner') : undefined"
      :role="notice.tone === 'error' ? 'alert' : 'status'"
    >
      {{ notice.text }}
    </UiBanner>

    <UiSkeleton v-if="loading" variant="card" />
    <UiSystemState v-else-if="failed" kind="generic" @action="rewards.refresh" />

    <template v-else>
      <section class="block" aria-labelledby="wallet-title">
        <h2 id="wallet-title" class="ui-text-h2">{{ t('rewards.wallet.title') }}</h2>
        <UiEmptyState
          v-if="wallet.length === 0"
          :title="t('rewards.wallet.empty.title')"
          :description="t('rewards.wallet.empty.body')"
          icon="gift"
          :heading-level="3"
        />
        <ul v-else class="list">
          <li v-for="w in wallet" :key="w.businessName">
            <UiCard class="row">
              <p class="ui-text-h3 row__main">
                {{ t('rewards.wallet.points', { points: w.points.toLocaleString('en') }) }}
              </p>
              <p class="ui-text-caption ui-text-hint">
                {{ t('rewards.wallet.from', { business: w.businessName }) }}
              </p>
            </UiCard>
          </li>
        </ul>
      </section>

      <section class="block" aria-labelledby="available-title">
        <h2 id="available-title" class="ui-text-h2">{{ t('rewards.available.title') }}</h2>
        <UiEmptyState
          v-if="available.length === 0"
          :title="t('rewards.available.empty.title')"
          :description="t('rewards.available.empty.body')"
          icon="gift"
          :heading-level="3"
        >
          <UiButton to="/discover">{{ t('me.empty.action') }}</UiButton>
        </UiEmptyState>
        <ul v-else class="list">
          <li v-for="a in available" :key="a.id">
            <UiCard class="row">
              <div class="row__main">
                <p class="ui-text-h3">{{ a.prizeName ?? a.campaign.title }}</p>
                <p class="ui-text-body">{{ awardAmount(a) ?? t('rewards.award.text') }}</p>
                <p class="ui-text-caption ui-text-hint">
                  <UiLink v-if="a.campaign.slug" :to="`/c/${a.campaign.slug}`">{{
                    a.campaign.title
                  }}</UiLink>
                  <template v-else>{{ a.campaign.title }}</template>
                  · {{ t('rewards.award.from', { business: a.businessName }) }}
                  <template v-if="a.rank">
                    · {{ t('rewards.award.place', { n: a.rank }) }}</template
                  >
                  <template v-if="deadline(a)"> · {{ deadline(a) }}</template>
                </p>
              </div>
              <div class="row__side">
                <UiButton
                  size="xs"
                  :loading="busy === a.id"
                  :loading-label="t('rewards.action.claiming')"
                  @click="start(a)"
                >
                  {{ t('rewards.action.claim') }}
                </UiButton>
                <UiButton variant="tertiary" size="xs" @click="startReport(a)">
                  {{ t('rewards.report.action') }}
                  <span class="ui-sr-only">{{
                    t('rewards.report.action.for', { prize: a.prizeName ?? a.campaign.title })
                  }}</span>
                </UiButton>
              </div>
            </UiCard>
          </li>
        </ul>
      </section>

      <section class="block" aria-labelledby="claimed-title">
        <h2 id="claimed-title" class="ui-text-h2">{{ t('rewards.claimed.title') }}</h2>
        <UiEmptyState
          v-if="history.length === 0"
          :title="t('rewards.claimed.empty.title')"
          :description="t('rewards.claimed.empty.body')"
          icon="ticket"
          :heading-level="3"
        />
        <ul v-else class="list">
          <li v-for="a in history" :key="a.id">
            <UiCard class="row">
              <div class="row__main">
                <p class="ui-text-h3">{{ a.prizeName ?? a.campaign.title }}</p>
                <p class="ui-text-body">{{ awardAmount(a) ?? t('rewards.award.text') }}</p>
                <p class="ui-text-caption ui-text-hint">
                  {{ t('rewards.award.from', { business: a.businessName }) }} ·
                  {{ dateOf(a.createdAt) }}
                  <template v-if="a.claimHint">
                    · {{ t('rewards.award.sentTo', { hint: a.claimHint }) }}
                  </template>
                </p>
                <p v-if="checking(a)" class="ui-text-caption ui-text-hint">
                  {{ a.claimHint ? t('rewards.held.claimed') : t('rewards.held.checking') }}
                </p>
              </div>
              <div class="row__side">
                <UiStatusChip vocabulary="rewardUnit" :status="chipStatus(a.status)" />
                <UiButton variant="tertiary" size="xs" @click="startReport(a)">
                  {{ t('rewards.report.action') }}
                  <span class="ui-sr-only">{{
                    t('rewards.report.action.for', { prize: a.prizeName ?? a.campaign.title })
                  }}</span>
                </UiButton>
              </div>
            </UiCard>
          </li>
        </ul>
      </section>
    </template>

    <ClaimDialog v-model:open="dialog" :award="claiming" :submit="submitClaim" />
    <ReportDialog v-model:open="reportOpen" :submit="sendReport" />
  </ParticipantShell>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-8);
}
.head__title {
  margin: 0;
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  letter-spacing: -0.025em;
}
.head__summary {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.row__side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.row__main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  min-inline-size: 0;
}
.row__main p {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
