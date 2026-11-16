<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../../i18n';
import { browserZone } from '../../campaigns/logic';
import {
  activitySeries,
  busiestDay,
  completionPercent,
  dayLabel,
  durationParts,
  funnelPoints,
  minutesBetween,
} from '../logic';
import type { CampaignActivity, Participation } from '../types';
import { useParticipants } from '../useParticipants';

/**
 * The summary of one participation: what this person did (status, when, how long, a quiz result) and how
 * the campaign they took part in is going (a funnel and the last two weeks of activity, with a quiz's
 * pass rate). The chart numbers are counts for the whole campaign; they hold no names and no answers.
 */
const props = defineProps<{ open: boolean; participation: Participation | null }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const store = useParticipants();
const zone = browserZone();
const activity = ref<CampaignActivity | null>(null);
const state = ref<'loading' | 'ready' | 'error'>('loading');

async function load() {
  const p = props.participation;
  if (!p) return;
  state.value = 'loading';
  activity.value = null;
  try {
    activity.value = await store.campaign(p.campaignId);
    state.value = 'ready';
  } catch {
    state.value = 'error';
  }
}
watch(
  () => [props.open, props.participation?.id] as const,
  ([open]) => {
    if (open) void load();
  },
);

const p = computed(() => props.participation);
const when = (iso: string | null) => (iso ? formatInZone(new Date(iso), zone) : '-');
const typeLabel = computed(() => (p.value ? t(`tpl.archetype.${p.value.kind}` as AppTextKey) : ''));
function took(minutes: number): string {
  const d = durationParts(minutes);
  return d.unit === 'min'
    ? t('participants.dialog.minutes', { n: d.a })
    : t(d.unit === 'hours' ? 'participants.dialog.hours' : 'participants.dialog.days', {
        a: d.a,
        b: d.b,
      });
}
const facts = computed(() => {
  const x = p.value;
  if (!x) return [];
  return [
    { label: t('participants.dialog.campaign'), value: `${x.campaignTitle} (${typeLabel.value})` },
    { label: t('participants.dialog.started'), value: when(x.startedAt) },
    { label: t('participants.dialog.finished'), value: when(x.completedAt) },
    ...(x.completedAt
      ? [
          {
            label: t('participants.dialog.took'),
            value: took(minutesBetween(x.startedAt, x.completedAt)),
          },
        ]
      : []),
    ...(x.result
      ? [
          {
            label: t('participants.dialog.result'),
            value: `${t('participants.result', { score: x.result.score, total: x.result.total })} · ${
              x.result.passed ? t('participants.passed') : t('participants.notPassed')
            }`,
          },
        ]
      : []),
  ];
});

const a = computed(() => activity.value);
const funnel = computed(() =>
  a.value
    ? [
        {
          name: t('participants.chart.funnel'),
          points: funnelPoints(a.value, {
            started: t('participants.chart.started'),
            completed: t('participants.chart.completed'),
            passed: t('participants.chart.passed'),
          }),
        },
      ]
    : [],
);
const funnelSummary = computed(() => {
  if (!a.value) return '';
  const base = t('participants.chart.funnel.summary', {
    completed: a.value.completed,
    started: a.value.started,
    percent: completionPercent(a.value.started, a.value.completed),
  });
  return a.value.quiz && a.value.quiz.correctPercent !== null
    ? `${base} ${t('participants.chart.funnel.quiz', {
        passed: a.value.quiz.passed,
        failed: a.value.quiz.failed,
        percent: a.value.quiz.correctPercent,
      })}`
    : base;
});
const series = computed(() =>
  a.value
    ? activitySeries(a.value.daily, {
        started: t('participants.chart.started'),
        completed: t('participants.chart.completed'),
      })
    : [],
);
const activitySummary = computed(() => {
  const best = a.value ? busiestDay(a.value.daily) : null;
  return best
    ? t('participants.chart.activity.summary', { day: dayLabel(best.date), n: best.started })
    : t('participants.chart.activity.none');
});
</script>

<template>
  <UiDialog
    :open="open"
    size="lg"
    :title="t('participants.dialog.title')"
    :description="p ? p.name : undefined"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="p" class="summary">
      <div class="summary__status">
        <UiBadge
          :tone="p.status === 'completed' ? 'success' : 'info'"
          :icon="p.status === 'completed' ? 'check-circle' : 'clock'"
        >
          {{ t(`participants.status.${p.status}` as AppTextKey) }}
        </UiBadge>
      </div>
      <dl class="facts">
        <div v-for="f in facts" :key="f.label" class="facts__row">
          <dt class="ui-text-label-sm ui-text-hint">{{ f.label }}</dt>
          <dd class="ui-text-body">{{ f.value }}</dd>
        </div>
      </dl>

      <h3 class="ui-text-h3">{{ t('participants.dialog.campaignTitle') }}</h3>
      <p class="ui-text-body-s ui-text-hint">{{ t('participants.dialog.campaignNote') }}</p>

      <UiSkeleton v-if="state === 'loading'" variant="card" />
      <UiSystemState v-else-if="state === 'error'" kind="generic" @action="load" />
      <template v-else-if="a">
        <UiChart
          type="funnel"
          :title="t('participants.chart.funnel')"
          :series="funnel"
          :summary="funnelSummary"
        />
        <UiChart
          type="bar"
          :title="t('participants.chart.activity')"
          :series="series"
          :summary="activitySummary"
        />
      </template>
    </div>
    <template #footer>
      <UiButton variant="secondary" @click="emit('update:open', false)">
        {{ t('participants.dialog.close') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.summary h3,
.summary p {
  margin: 0;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--ui-space-3) var(--ui-space-4);
  margin: 0;
}
.facts__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
