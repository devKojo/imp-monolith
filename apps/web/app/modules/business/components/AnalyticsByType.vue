<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import type {
  BusinessActivity,
  CampaignParticipation,
  ParticipationKind,
} from '../../participants/types';
import { dayLabel } from '../../participants/logic';
import type { CampaignResults } from '../../voting/types';
import { useCampaignResults } from '../../voting/useVoting';
import { barsOfKinds, campaignBars, kindSeries, leadingOption, standingsBars } from '../overview';

/**
 * The drill-down under the dashboard's overview: one tab per campaign type the business has, and for the
 * chosen type the charts that belong to it (participation by day, by campaign, and, for a quiz, how people
 * did; for a poll or image vote, how the vote stands, question by question). Types the business has not
 * used get no tab, so the page grows with the business, not with the number of campaign types.
 */
const props = defineProps<{
  campaigns: readonly CampaignParticipation[];
  activity: BusinessActivity | null;
}>();

const ORDER: ParticipationKind[] = ['quiz', 'survey', 'poll', 'vote', 'giveaway'];
const typeName = (k: ParticipationKind) => t(`type.${k}.one` as 'type.quiz.one');

const present = computed(() =>
  ORDER.filter((k) => props.campaigns.some((c) => c.kind === k)).map((k) => ({
    id: k,
    label: typeName(k),
  })),
);
const current = ref<ParticipationKind | ''>('');
watch(
  present,
  (tabs) => {
    if (!tabs.some((x) => x.id === current.value)) current.value = tabs[0]?.id ?? '';
  },
  { immediate: true },
);

const kind = computed(() => (current.value === '' ? null : current.value));
const ofKind = computed(() => props.campaigns.filter((c) => c.kind === kind.value));
const names = computed(() => ({
  started: t('participants.chart.started'),
  completed: t('participants.chart.completed'),
}));

const participations = computed(() => ofKind.value.reduce((n, c) => n + c.started, 0));
const completed = computed(() => ofKind.value.reduce((n, c) => n + c.completed, 0));

/** The chosen type's participation over the last days. */
const daily = computed(() =>
  kind.value && props.activity
    ? kindSeries(
        props.activity.daily,
        { [kind.value]: props.activity.byKind[kind.value] },
        typeName,
        dayLabel,
      )
    : [],
);
const byCampaign = computed(() =>
  kind.value === 'poll' || kind.value === 'vote' || kind.value === 'giveaway'
    ? barsOfKinds(
        ofKind.value,
        [kind.value],
        t(kind.value === 'giveaway' ? 'participants.chart.entries' : 'participants.chart.votes'),
        8,
      )
    : campaignBars(
        ofKind.value.filter((c) => c.started > 0),
        names.value,
        8,
      ),
);
const byCampaignTitle = computed(() =>
  kind.value === 'giveaway'
    ? t('overview.chart.entries')
    : kind.value === 'poll' || kind.value === 'vote'
      ? t('overview.chart.votes')
      : t('overview.chart.byCampaign'),
);

const quiz = computed(() => (kind.value === 'quiz' ? (props.activity?.quiz ?? null) : null));
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

// ---- how one poll or image vote stands, question by question
const ballotApi = useCampaignResults();
const isBallot = computed(() => kind.value === 'poll' || kind.value === 'vote');
const ballots = computed(() => ofKind.value.filter((c) => c.started > 0).slice(0, 8));
const ballotChoices = computed(() =>
  ballots.value.map((b) => ({ value: b.campaignId, label: b.title })),
);
const standingsId = ref('');
const standings = ref<CampaignResults | null>(null);
const questionId = ref('');
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
watch(
  [ballots, isBallot],
  ([list, ballot]) => {
    if (!ballot) return;
    if (!list.some((b) => b.campaignId === standingsId.value))
      standingsId.value = list[0]?.campaignId ?? '';
  },
  { immediate: true },
);
watch(
  [standingsId, isBallot],
  async ([id, ballot]) => {
    standings.value = null;
    if (!ballot || !id) return void (state.value = 'idle');
    state.value = 'loading';
    try {
      const data = await ballotApi.results(id);
      // The person may have picked another campaign while this one loaded.
      if (id !== standingsId.value) return;
      standings.value = data;
      questionId.value = data.questions[0]?.id ?? '';
      state.value = 'ready';
    } catch {
      if (id === standingsId.value) state.value = 'error';
    }
  },
  { immediate: true },
);
const question = computed(
  () => standings.value?.questions.find((q) => q.id === questionId.value) ?? null,
);
const questionChoices = computed(() =>
  (standings.value?.questions ?? []).map((q, i) => ({
    value: q.id,
    label: `${i + 1}. ${q.question || standings.value?.title || ''}`,
  })),
);
const standingsSeries = computed(() =>
  question.value ? standingsBars(question.value, t('participants.chart.votes')) : [],
);
const standingsSummary = computed(() => {
  const lead = question.value ? leadingOption(question.value) : null;
  return lead && question.value
    ? t('overview.chart.standings.summary', {
        name: lead.label,
        votes: lead.votes,
        total: question.value.total,
      })
    : t('overview.chart.standings.empty');
});
</script>

<template>
  <section v-if="present.length > 0" class="drill" aria-labelledby="drill-title">
    <div class="drill__head">
      <h2 id="drill-title" class="ui-text-h2">{{ t('overview.drill.title') }}</h2>
      <p class="ui-text-body-s ui-text-hint">{{ t('overview.drill.hint') }}</p>
    </div>

    <UiTabs v-model="current" :tabs="present" :label="t('overview.drill.label')">
      <template v-for="tab in present" :key="tab.id" #[`panel-${tab.id}`]>
        <div v-if="tab.id === current" class="panel">
          <p class="ui-text-body-s ui-text-hint">
            {{
              t('overview.drill.summary', {
                campaigns: ofKind.length,
                n: participations,
                done: completed,
              })
            }}
          </p>

          <div class="grid">
            <UiCard v-if="daily.length > 0" as="section" class="chart">
              <UiChart
                type="line"
                :title="t('overview.drill.daily', { type: typeName(tab.id) })"
                :series="daily"
                :summary="t('overview.drill.daily.summary', { type: typeName(tab.id) })"
                :table-limit="5"
              />
            </UiCard>
            <UiCard v-else as="section" class="chart">
              <p class="ui-text-body-s ui-text-hint">{{ t('participants.chart.activity.none') }}</p>
            </UiCard>

            <UiCard v-if="byCampaign.length > 0" as="section" class="chart">
              <UiChart
                type="bar"
                :title="byCampaignTitle"
                :series="byCampaign"
                :summary="t('overview.drill.campaigns.summary', { type: typeName(tab.id) })"
                :table-limit="5"
              />
            </UiCard>

            <UiCard v-if="quiz" as="section" class="chart">
              <UiChart
                type="donut"
                :title="t('participants.chart.outcome')"
                :series="outcome"
                :summary="
                  quiz.correctPercent !== null
                    ? t('participants.chart.funnel.quiz', {
                        passed: quiz.passed,
                        failed: quiz.failed,
                        percent: quiz.correctPercent,
                      })
                    : ''
                "
                :center-text="String(quiz.passed + quiz.failed)"
              />
            </UiCard>

            <UiCard v-if="isBallot && ballots.length > 0" as="section" class="chart">
              <UiSelect
                :id="`standings-campaign-${tab.id}`"
                v-model="standingsId"
                :label="t('overview.chart.standings.pick')"
                :options="ballotChoices"
              />
              <UiSelect
                v-if="questionChoices.length > 1"
                :id="`standings-question-${tab.id}`"
                v-model="questionId"
                :label="t('overview.drill.question')"
                :options="questionChoices"
              />
              <UiSkeleton v-if="state === 'loading'" variant="card" />
              <UiBanner v-else-if="state === 'error'" tone="error" role="alert">
                {{ t('overview.chart.standings.failed') }}
              </UiBanner>
              <UiChart
                v-else-if="question && question.total > 0"
                type="bar"
                :title="t('overview.chart.standings')"
                :series="standingsSeries"
                :summary="standingsSummary"
                :table-limit="5"
              />
              <p v-else class="ui-text-body-s ui-text-hint">
                {{ t('overview.chart.standings.empty') }}
              </p>
            </UiCard>
          </div>
        </div>
      </template>
    </UiTabs>
  </section>
</template>

<style scoped>
.drill {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin-block-start: var(--ui-space-8);
}
.drill__head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.drill__head h2,
.drill__head p {
  margin: 0;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding-block-start: var(--ui-space-4);
}
.panel p {
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-5);
}
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.chart {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.chart :deep(.ui-chart__svg) {
  display: block;
  max-inline-size: 40rem;
  margin-inline: auto;
}
</style>
