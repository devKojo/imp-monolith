<script setup lang="ts">
import { computed } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { timeLeftText } from '../../discovery/logic';
import type { DiscoveryCampaign } from '../../discovery/types';
import type { MyAward } from '../../rewards/types';
import RewardWon from '../../rewards/components/RewardWon.vue';
import type { AttemptView, QuizInfo } from '../types';

/**
 * The outcome of a quiz, laid out as a result page: a header naming the campaign, the verdict with
 * the score, what happens next (the reward on a pass, a retry on a miss), a short performance
 * summary with the full breakdown behind a disclosure, and one more campaign to try. A pass is
 * celebrated (confetti only when `celebrate` is set, i.e. the person has just finished). It shows
 * only what the server knows: the person's own answers, never which were correct. Meaning is never
 * colour alone.
 */
const props = defineProps<{
  /** The finished attempt; its `result` is set. */
  view: AttemptView;
  /** The public rules and title; null while loading or if they could not be read. */
  info?: QuizInfo | null;
  /** Another open campaign to suggest, if there is one. */
  next?: DiscoveryCampaign | null;
  timeUp?: boolean;
  /** Fire the confetti: true only right after finishing, not when coming back to the page. */
  celebrate?: boolean;
  /** The tier this person won by passing, when the prizes go to the first to pass. */
  reward?: MyAward | null;
  /** A retake is being started. */
  retaking?: boolean;
  /** Current time in ms, for the suggested campaign's countdown. */
  now?: number;
}>();
const emit = defineEmits<{ retake: [] }>();

const result = computed(() => props.view.result!);
const passed = computed(() => result.value.passed);
const left = computed(() => props.view.maxAttempts - props.view.attemptNumber);
const percent = computed(() =>
  result.value.total > 0 ? Math.round((result.value.score / result.value.total) * 100) : 0,
);

const fmt = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

const seconds = computed(() =>
  props.view.submittedAt
    ? Math.max(
        0,
        Math.round((Date.parse(props.view.submittedAt) - Date.parse(props.view.startedAt)) / 1000),
      )
    : null,
);
const taken = computed(() =>
  seconds.value === null
    ? '-'
    : t('quiz.details.duration', { m: Math.floor(seconds.value / 60), s: seconds.value % 60 }),
);
const limit = computed(() =>
  props.info?.timeLimitMinutes
    ? t('quiz.perf.limit', { n: props.info.timeLimitMinutes })
    : t('quiz.perf.noLimit'),
);

const answered = computed(
  () => props.view.questions.filter((q) => props.view.answers[q.id] !== undefined).length,
);

const answers = computed(() =>
  props.view.questions.map((q, i) => {
    const chosen = props.view.answers[q.id];
    return {
      id: q.id,
      n: i + 1,
      prompt: q.prompt,
      answer: chosen === undefined ? t('quiz.details.unanswered') : (q.options[chosen] ?? ''),
    };
  }),
);

const rows = computed(() => [
  {
    label: t('quiz.details.attempt'),
    value: t('quiz.attempt.of', { n: props.view.attemptNumber, max: props.view.maxAttempts }),
  },
  { label: t('quiz.details.started'), value: fmt(props.view.startedAt) },
  ...(props.view.submittedAt
    ? [{ label: t('quiz.details.finished'), value: fmt(props.view.submittedAt) }]
    : []),
]);

const nextEnds = computed(() =>
  props.next
    ? {
        left: timeLeftText(props.next.endsAt, props.now ?? Date.now()),
        at: formatInZone(new Date(props.next.endsAt), props.next.timeZone),
      }
    : null,
);
</script>

<template>
  <div class="page">
    <UiConfetti v-if="passed && celebrate" />

    <UiCard as="header" class="head">
      <div class="head__tags">
        <UiBadge shape="pill" tone="info">{{ t('type.quiz.one') }}</UiBadge>
        <span v-if="info" class="ui-text-caption ui-text-hint">
          {{ t('quiz.result.by', { business: info.businessName }) }}
        </span>
      </div>
      <h1 class="head__title ui-text-h2">{{ info?.title ?? t('quiz.page.title') }}</h1>
      <p v-if="view.submittedAt" class="ui-text-caption ui-text-hint head__meta">
        {{ t('quiz.result.evaluated', { when: fmt(view.submittedAt) }) }}
      </p>
    </UiCard>

    <UiBanner v-if="timeUp" tone="info" :title="t('quiz.timeUp.title')">
      {{ t('quiz.timeUp.body') }}
    </UiBanner>

    <UiCard as="section" aria-labelledby="quiz-result" class="verdict">
      <div class="verdict__main">
        <UiIconTile
          :icon="passed ? 'check-circle' : 'alert-circle'"
          :tone="passed ? 'success' : 'warning'"
        />
        <div class="verdict__text">
          <UiBadge
            :tone="passed ? 'success' : 'warning'"
            :icon="passed ? 'check-circle' : 'alert-circle'"
          >
            {{ passed ? t('quiz.result.passed') : t('quiz.result.failed') }}
          </UiBadge>
          <h2 id="quiz-result" class="ui-text-h1 verdict__title">
            {{ passed ? t('quiz.result.congrats') : t('quiz.result.sorry') }}
          </h2>
          <p class="ui-text-body-l verdict__body">
            {{ passed ? t('quiz.result.passedBody') : t('quiz.result.failedBody') }}
          </p>
        </div>
      </div>
      <dl class="score">
        <div>
          <dt class="ui-text-caption ui-text-hint">{{ t('quiz.details.score') }}</dt>
          <dd class="score__value">{{ percent }}%</dd>
          <dd class="ui-text-caption ui-text-hint">
            {{ t('quiz.result.score', { score: result.score, total: result.total }) }}
          </dd>
        </div>
        <div>
          <dt class="ui-text-caption ui-text-hint">{{ t('quiz.details.mark') }}</dt>
          <dd class="score__value">{{ result.passPercent }}%</dd>
        </div>
      </dl>
    </UiCard>

    <div class="grid">
      <UiCard as="section" aria-labelledby="quiz-next-step" class="next">
        <template v-if="passed && reward">
          <RewardWon :reward="reward" heading-id="quiz-next-step" />
        </template>
        <template v-else-if="passed">
          <h2 id="quiz-next-step" class="ui-text-h3">{{ t('quiz.reward.title') }}</h2>
          <p class="ui-text-body">{{ t('quiz.reward.body') }}</p>
          <UiButton to="/me/rewards" icon="arrow-right">{{ t('quiz.reward.action') }}</UiButton>
        </template>
        <template v-else>
          <h2 id="quiz-next-step" class="ui-text-h3">
            {{ left > 0 ? t('quiz.retry.title') : t('quiz.retry.none.title') }}
          </h2>
          <p class="ui-text-body">
            {{ left > 0 ? t('quiz.retry.body') : t('quiz.retry.none.body') }}
          </p>
          <p class="ui-text-caption ui-text-hint">
            {{
              left > 0
                ? t(left === 1 ? 'quiz.retake.left.one' : 'quiz.retake.left', { n: left })
                : t('quiz.retake.none')
            }}
          </p>
          <UiButton
            v-if="left > 0"
            icon="refresh"
            :loading="retaking"
            :loading-label="t('quiz.saving')"
            @click="emit('retake')"
          >
            {{ t('quiz.retry') }}
          </UiButton>
        </template>
        <UiButton to="/me" variant="secondary">{{ t('quiz.toDashboard') }}</UiButton>
      </UiCard>

      <UiCard as="section" aria-labelledby="quiz-perf" class="perf">
        <h2 id="quiz-perf" class="ui-text-h3">{{ t('quiz.perf.title') }}</h2>
        <div class="tiles">
          <UiStatCard
            label-style="plain"
            :label="t('quiz.perf.answered')"
            :value="`${answered} / ${view.questions.length}`"
          />
          <UiStatCard
            label-style="plain"
            :label="t('quiz.perf.accuracy')"
            :value="`${result.score} / ${result.total}`"
            :suffix="`${percent}%`"
          />
          <UiStatCard
            label-style="plain"
            :label="t('quiz.details.taken')"
            :value="taken"
            :suffix="limit"
          />
        </div>
        <UiAccordion :items="[{ id: 'details', title: t('quiz.details.title') }]">
          <template #item-details>
            <dl class="facts">
              <div v-for="row in rows" :key="row.label" class="facts__row">
                <dt class="ui-text-caption ui-text-hint">{{ row.label }}</dt>
                <dd class="ui-text-body">{{ row.value }}</dd>
              </div>
            </dl>
            <h3 class="ui-text-label answers__title">{{ t('quiz.details.answers') }}</h3>
            <ol class="answers">
              <li v-for="a in answers" :key="a.id">
                <span class="ui-text-label">{{ a.n }}. {{ a.prompt }}</span>
                <span class="ui-text-body">
                  {{ t('quiz.details.yourAnswer', { a: a.answer }) }}
                </span>
              </li>
            </ol>
          </template>
        </UiAccordion>
      </UiCard>
    </div>

    <section v-if="next" class="more" aria-labelledby="quiz-more">
      <div class="more__head">
        <div>
          <h2 id="quiz-more" class="ui-text-h2">{{ t('quiz.next.title') }}</h2>
          <p class="ui-text-body hint">{{ t('quiz.next.subtitle') }}</p>
        </div>
        <UiLink to="/discover">{{ t('quiz.next.all') }}</UiLink>
      </div>
      <UiCard class="more__card">
        <div class="more__text">
          <div class="head__tags">
            <UiBadge shape="pill" tone="info">{{ t(`type.${next.type}.one` as never) }}</UiBadge>
            <span class="ui-text-caption ui-text-hint">
              {{ t('quiz.result.by', { business: next.businessName }) }}
            </span>
          </div>
          <h3 class="ui-text-h3">{{ next.title }}</h3>
          <p v-if="next.summary" class="ui-text-body hint">{{ next.summary }}</p>
          <p v-if="nextEnds" class="ui-text-caption ui-text-hint">
            {{ nextEnds.left }} · {{ nextEnds.at }}
          </p>
        </div>
        <UiButton :to="`/c/${next.slug}`" icon="arrow-right">{{ t('quiz.next.action') }}</UiButton>
      </UiCard>
    </section>

    <nav class="back" :aria-label="t('quiz.back.label')">
      <UiLink to="/me">{{ t('quiz.toDashboard') }}</UiLink>
      <UiLink to="/discover">{{ t('quiz.toHome') }}</UiLink>
    </nav>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}
.head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.head__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.head__title,
.head__meta,
.verdict__title,
.verdict__body {
  margin: 0;
}
.verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-6);
}
.verdict__main {
  display: flex;
  flex: 1 1 22rem;
  align-items: flex-start;
  gap: var(--ui-space-4);
}
.verdict__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-2);
}
.verdict__body {
  color: var(--ui-color-text-secondary);
}
.score {
  display: flex;
  gap: var(--ui-space-6);
  margin: 0;
  padding: var(--ui-space-4) var(--ui-space-6);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-color-surface-page);
}
.score dd {
  margin: 0;
}
.score__value {
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  color: var(--ui-color-action-primary);
}
.grid {
  display: grid;
  gap: var(--ui-space-6);
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .grid {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    align-items: start;
  }
}
.next,
.perf {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-3);
}
.next h2,
.next p,
.perf h2 {
  margin: 0;
}
.perf {
  align-items: stretch;
}
.tiles {
  display: grid;
  gap: var(--ui-space-3);
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}
.facts {
  display: grid;
  gap: var(--ui-space-2);
  margin: 0;
}
.facts__row {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.facts dd {
  margin: 0;
}
.answers__title {
  margin-block: var(--ui-space-4) var(--ui-space-2);
}
.answers {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin: 0;
  padding-inline-start: 0;
  list-style: none;
}
.answers li {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.more {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.more__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.more__head h2,
.more__head p {
  margin: 0;
}
.hint {
  color: var(--ui-color-text-secondary);
}
.more__card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.more__text {
  display: flex;
  flex: 1 1 20rem;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.more__text h3,
.more__text p {
  margin: 0;
}
.back {
  display: flex;
  justify-content: center;
  gap: var(--ui-space-6);
}
</style>
