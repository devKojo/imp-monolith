<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { SIGNIN } from '../../modules/auth/constants';
import BusinessShell from '../../modules/business/components/BusinessShell.vue';
import { campaignBars, statusCounts, type StatusKey } from '../../modules/business/overview';
import { classifyAuthError, toApiError, type AuthFailure } from '../../modules/auth/errors';
import { ROLE_LABELS } from '../../modules/auth/validation';
import { campaignErrorKey } from '../../modules/campaigns/errors';
import type { CampaignSummary } from '../../modules/campaigns/types';
import { useCampaigns } from '../../modules/campaigns/useCampaigns';
import {
  activitySeries,
  busiestDay,
  completionPercent,
  dayLabel,
} from '../../modules/participants/logic';
import type { BusinessActivity, ParticipantSummary } from '../../modules/participants/types';
import { useParticipants } from '../../modules/participants/useParticipants';

/**
 * Business overview (client-rendered, no-store: private data never passes the SSR tier). The headline
 * figures and the analytics of the active business: campaigns by status, participation over the last
 * days and by campaign, and quiz outcomes. The campaigns themselves live on the Campaigns page, so the
 * list is not repeated here. Everything is real, read from the campaigns and participants APIs; the
 * participation charts are shown only to roles that may see participants (the server decides).
 */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('console.title') });

const auth = useAuth();
const session = auth.session;
const store = useCampaigns();
const people = useParticipants();
const failure = ref<AuthFailure | null>(null);
const switching = ref(false);

const selected = ref(session.value?.active?.membershipId ?? '');
const options = computed(
  () =>
    session.value?.memberships.map((m) => ({
      value: m.membershipId,
      label: `${m.businessName} (${ROLE_LABELS[m.role] ?? m.role})`,
    })) ?? [],
);

// ---- the campaigns of the active business
const items = ref<CampaignSummary[]>([]);
const loading = ref(true);
const loadFailed = ref(false);
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

// ---- participation, only for roles that may see it. A failure leaves the charts out and the figure a dash.
const participants = ref<ParticipantSummary | null>(null);
const activity = ref<BusinessActivity | null>(null);
async function loadParticipation() {
  participants.value = null;
  activity.value = null;
  if (!people.canView.value) return;
  [participants.value, activity.value] = await Promise.all([
    people.summary().catch(() => null),
    people.activity().catch(() => null),
  ]);
}
onMounted(() => {
  void load();
  void loadParticipation();
});

const count = (s: CampaignSummary['status']) => items.value.filter((c) => c.status === s).length;
const live = computed(() => count('LIVE'));
const scheduled = computed(() => count('SCHEDULED'));
const drafts = computed(() => count('DRAFT'));

// ---- the charts
const statusLabel = (k: StatusKey) => t(`cmp.filter.${k}` as 'cmp.filter.live');
const byStatus = computed(() => statusCounts(items.value, statusLabel));
const statusSummary = computed(() =>
  t('overview.chart.status.summary', {
    n: items.value.length,
    live: live.value,
    scheduled: scheduled.value,
    drafts: drafts.value,
  }),
);

const names = computed(() => ({
  started: t('participants.chart.started'),
  completed: t('participants.chart.completed'),
}));
const daily = computed(() =>
  activity.value ? activitySeries(activity.value.daily, names.value) : [],
);
const dailySummary = computed(() => {
  const best = activity.value ? busiestDay(activity.value.daily) : null;
  return best
    ? t('participants.chart.activity.summary', { day: dayLabel(best.date), n: best.started })
    : t('participants.chart.activity.none');
});

const campaigns = computed(() => participants.value?.campaigns ?? []);
const byCampaign = computed(() => campaignBars(campaigns.value, names.value));
const byCampaignSummary = computed(() => {
  const top = campaigns.value[0];
  return top
    ? t('overview.chart.byCampaign.summary', { title: top.title, n: top.started })
    : t('participants.empty.body');
});

const quiz = computed(() => activity.value?.quiz ?? null);
const outcome = computed(() =>
  quiz.value
    ? [
        {
          name: t('participants.chart.outcome'),
          points: [
            { label: t('participants.chart.passed'), value: quiz.value.passed },
            { label: t('participants.chart.notPassed'), value: quiz.value.failed },
          ],
        },
      ]
    : [],
);
const outcomeSummary = computed(() =>
  quiz.value && quiz.value.correctPercent !== null
    ? t('participants.chart.funnel.quiz', {
        passed: quiz.value.passed,
        failed: quiz.value.failed,
        percent: quiz.value.correctPercent,
      })
    : '',
);
const completion = computed(() =>
  participants.value
    ? completionPercent(participants.value.started, participants.value.completed)
    : 0,
);

// ---- starting a campaign
const problem = ref('');
const creating = ref(false);
async function createNew() {
  problem.value = '';
  creating.value = true;
  try {
    const created = await store.create(t('cmp.newTitle'));
    await navigateTo(`/app/campaigns/${created.id}`);
  } catch (e) {
    problem.value = t(campaignErrorKey(toApiError(e)));
  } finally {
    creating.value = false;
  }
}

async function onSwitch(membershipId: string) {
  if (membershipId === session.value?.active?.membershipId) return;
  failure.value = null;
  switching.value = true;
  try {
    await auth.switchTenant(membershipId);
    await Promise.all([load(), loadParticipation()]); // both belong to the business that is now active
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'unauthenticated') await navigateTo(SIGNIN.business);
    failure.value = f;
    selected.value = session.value?.active?.membershipId ?? '';
  } finally {
    switching.value = false;
  }
}
</script>

<template>
  <BusinessShell current="overview">
    <template #actions>
      <UiButton
        v-if="store.canManage.value"
        size="xs"
        icon="plus"
        :loading="creating"
        :loading-label="t('cmp.creating')"
        @click="createNew"
      >
        {{ t('console.create') }}
      </UiButton>
    </template>

    <UiSystemState v-if="failure" kind="generic" />
    <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

    <header class="page-head">
      <h1 class="ui-text-h1 page-head__title">{{ t('console.title') }}</h1>
      <UiSelect
        v-if="options.length > 1"
        v-model="selected"
        :label="t('console.switch')"
        :options="options"
        :disabled="switching"
        @update:model-value="onSwitch"
      />
    </header>

    <UiSystemState v-if="loadFailed" kind="generic" @action="load" />

    <template v-else>
      <section class="stats">
        <UiStatCard
          :label="t('console.stat.campaigns')"
          :value="loading ? '-' : t('console.stat.live', { n: live })"
          :suffix="loading ? '' : t('console.stat.ofTotal', { n: items.length })"
        />
        <UiStatCard
          :label="t('console.stat.scheduledLabel')"
          :value="loading ? '-' : String(scheduled)"
        />
        <UiStatCard
          :label="t('console.stat.draftsLabel')"
          :value="loading ? '-' : String(drafts)"
        />
        <UiStatCard
          v-if="people.canView.value"
          :label="t('console.stat.participants')"
          :value="participants ? String(participants.participants) : '-'"
          :suffix="participants ? t('overview.stat.completion', { n: completion }) : ''"
          icon="users"
        />
      </section>

      <UiSkeleton v-if="loading" variant="card" />

      <UiEmptyState
        v-else-if="items.length === 0"
        :title="t('console.table.none.title')"
        :description="t('console.table.none.body')"
      >
        <UiButton v-if="store.canManage.value" size="xs" icon="plus" @click="createNew">
          {{ t('console.create') }}
        </UiButton>
      </UiEmptyState>

      <template v-else>
        <div class="analytics-head">
          <h2 class="ui-text-h2">{{ t('overview.analytics') }}</h2>
          <UiButton to="/app/campaigns" variant="secondary" size="xs" icon-trailing="arrow-right">
            {{ t('overview.manage') }}
          </UiButton>
        </div>

        <section class="charts" :aria-label="t('overview.analytics')">
          <UiCard v-if="activity" as="section" class="chart">
            <UiChart
              type="bar"
              :title="t('overview.chart.activity')"
              :series="daily"
              :summary="dailySummary"
              :table-limit="5"
            />
          </UiCard>

          <UiCard v-if="campaigns.length > 0" as="section" class="chart">
            <UiChart
              type="bar"
              :title="t('overview.chart.byCampaign')"
              :series="byCampaign"
              :summary="byCampaignSummary"
              :table-limit="5"
            />
          </UiCard>

          <UiCard as="section" class="chart">
            <UiChart
              type="donut"
              :title="t('overview.chart.status')"
              :series="[{ name: t('overview.chart.status'), points: byStatus }]"
              :summary="statusSummary"
              :center-text="String(items.length)"
            />
          </UiCard>

          <UiCard v-if="quiz" as="section" class="chart">
            <UiChart
              type="donut"
              :title="t('participants.chart.outcome')"
              :series="outcome"
              :summary="outcomeSummary"
              :center-text="String(quiz.passed + quiz.failed)"
            />
          </UiCard>
        </section>
      </template>
    </template>
  </BusinessShell>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
@media (min-width: 768px) {
  .stats {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
}
.analytics-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-4);
}
.analytics-head h2 {
  margin: 0;
}
/* A chart is drawn on a fixed canvas that scales with its card; capped, a wide card does not blow it up. */
.chart :deep(.ui-chart__svg) {
  display: block;
  max-inline-size: 40rem;
  margin-inline: auto;
}
.charts {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-5);
}
@media (min-width: 1024px) {
  .charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
