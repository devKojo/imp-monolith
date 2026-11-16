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
  minutesBetween,
  outcomePoints,
} from '../logic';
import type { CampaignActivity, Participation } from '../types';
import { useParticipants } from '../useParticipants';

/**
 * The summary of one participation, kept short on first sight: the person's status and the three facts
 * that matter sit at the top, the rest is one click away ("Show details"), and one chart is shown at a
 * time (outcome or activity, with an area or bar view of activity). Its data table shows only the latest
 * rows until "View breakdown" is chosen. The chart numbers are counts for the whole campaign; they hold
 * no names and no answers. The header stays put and the body scrolls, so the dialog never outgrows the
 * screen.
 */
const props = defineProps<{ open: boolean; participation: Participation | null }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const store = useParticipants();
const zone = browserZone();
const activity = ref<CampaignActivity | null>(null);
const state = ref<'loading' | 'ready' | 'error'>('loading');
const view = ref('outcome');
const kind = ref('area');
const details = ref(false);

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
    if (!open) return;
    // Each opening starts from the short view.
    view.value = 'outcome';
    details.value = false;
    void load();
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

type Fact = { label: string; value: string };
/** What matters at a glance. */
const headline = computed<Fact[]>(() => {
  const x = p.value;
  if (!x) return [];
  return [
    { label: t('participants.dialog.campaign'), value: `${x.campaignTitle} (${typeLabel.value})` },
    { label: t('participants.dialog.started'), value: when(x.startedAt) },
    x.result
      ? {
          label: t('participants.dialog.result'),
          value: `${t('participants.result', { score: x.result.score, total: x.result.total })} · ${
            x.result.passed ? t('participants.passed') : t('participants.notPassed')
          }`,
        }
      : { label: t('participants.dialog.finished'), value: when(x.completedAt) },
  ];
});
/** What the person can open if they want it. */
const more = computed<Fact[]>(() => {
  const x = p.value;
  if (!x) return [];
  return [
    ...(x.result ? [{ label: t('participants.dialog.finished'), value: when(x.completedAt) }] : []),
    ...(x.completedAt
      ? [
          {
            label: t('participants.dialog.took'),
            value: took(minutesBetween(x.startedAt, x.completedAt)),
          },
        ]
      : []),
    { label: t('participants.dialog.type'), value: typeLabel.value },
  ];
});

const a = computed(() => activity.value);
const viewOptions = [
  { value: 'outcome', label: t('participants.tab.outcome') },
  { value: 'activity', label: t('participants.tab.activity') },
];
const kindOptions = [
  { value: 'area', label: t('participants.chartKind.area') },
  { value: 'bar', label: t('participants.chartKind.bar') },
];

const outcome = computed(() =>
  a.value
    ? [
        {
          name: t('participants.chart.outcome'),
          points: outcomePoints(a.value, {
            completed: t('participants.chart.completed'),
            passed: t('participants.chart.passed'),
            notPassed: t('participants.chart.notPassed'),
            inProgress: t('participants.status.in_progress'),
          }),
        },
      ]
    : [],
);
const outcomeSummary = computed(() => {
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
    closable
    :title="t('participants.dialog.title')"
    :description="p ? p.name : undefined"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="p" class="summary">
      <div class="summary__top">
        <UiBadge
          :tone="p.status === 'completed' ? 'success' : 'info'"
          :icon="p.status === 'completed' ? 'check-circle' : 'clock'"
        >
          {{ t(`participants.status.${p.status}` as AppTextKey) }}
        </UiBadge>
        <UiButton
          variant="tertiary"
          size="xs"
          :icon="details ? 'chevron-up' : 'chevron-down'"
          :aria-expanded="details"
          @click="details = !details"
        >
          {{
            details ? t('participants.dialog.hideDetails') : t('participants.dialog.showDetails')
          }}
        </UiButton>
      </div>

      <dl class="facts">
        <div v-for="f in headline" :key="f.label" class="facts__row">
          <dt class="ui-text-label-sm ui-text-hint">{{ f.label }}</dt>
          <dd class="ui-text-body">{{ f.value }}</dd>
        </div>
        <template v-if="details">
          <div v-for="f in more" :key="f.label" class="facts__row">
            <dt class="ui-text-label-sm ui-text-hint">{{ f.label }}</dt>
            <dd class="ui-text-body">{{ f.value }}</dd>
          </div>
        </template>
      </dl>

      <section class="charts" :aria-label="t('participants.dialog.campaignTitle')">
        <div class="charts__head">
          <div>
            <h3 class="ui-text-h3">{{ t('participants.dialog.campaignTitle') }}</h3>
            <p class="ui-text-body-s ui-text-hint">{{ t('participants.dialog.campaignNote') }}</p>
          </div>
          <div class="charts__controls">
            <UiSegmentedControl
              v-model="view"
              :label="t('participants.tab.label')"
              :options="viewOptions"
            />
            <UiSegmentedControl
              v-if="view === 'activity'"
              v-model="kind"
              :label="t('participants.chartKind.label')"
              :options="kindOptions"
            />
          </div>
        </div>

        <UiSkeleton v-if="state === 'loading'" variant="card" />
        <UiSystemState v-else-if="state === 'error'" kind="generic" @action="load" />
        <template v-else-if="a">
          <UiChart
            v-if="view === 'outcome'"
            type="donut"
            :title="t('participants.chart.outcome')"
            :series="outcome"
            :summary="outcomeSummary"
            :center-text="String(a.started)"
          />
          <UiChart
            v-else
            :type="kind === 'bar' ? 'bar' : 'area'"
            :title="t('participants.chart.activity')"
            :series="series"
            :summary="activitySummary"
            :table-limit="5"
          />
        </template>
      </section>
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
.summary__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--ui-space-3) var(--ui-space-4);
  margin: 0;
  padding: var(--ui-space-4);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
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
.charts {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.charts__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.charts__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
