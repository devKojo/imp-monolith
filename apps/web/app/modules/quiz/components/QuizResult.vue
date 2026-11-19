<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import type { AttemptView } from '../types';

/**
 * The outcome of a quiz. A pass is celebrated (confetti, only when `celebrate` is set, i.e. the
 * person has just finished) and points at the rewards page; a miss is met with a kind message and
 * a retry while attempts remain. The full breakdown sits behind a disclosure so the screen stays
 * short. It never shows which answer was correct. Meaning is never colour alone.
 */
const props = defineProps<{
  /** The finished attempt; its `result` is set. */
  view: AttemptView;
  timeUp?: boolean;
  /** Fire the confetti: true only right after finishing, not when coming back to the page. */
  celebrate?: boolean;
  /** A retake is being started. */
  retaking?: boolean;
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

const taken = computed(() => {
  if (!props.view.submittedAt) return null;
  const seconds = Math.max(
    0,
    Math.round((Date.parse(props.view.submittedAt) - Date.parse(props.view.startedAt)) / 1000),
  );
  return t('quiz.details.duration', { m: Math.floor(seconds / 60), s: seconds % 60 });
});

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
  { label: t('quiz.details.score'), value: `${result.value.score} / ${result.value.total}` },
  { label: t('quiz.details.percent'), value: `${percent.value}%` },
  { label: t('quiz.details.mark'), value: `${result.value.passPercent}%` },
  {
    label: t('quiz.details.attempt'),
    value: t('quiz.attempt.of', { n: props.view.attemptNumber, max: props.view.maxAttempts }),
  },
  { label: t('quiz.details.started'), value: fmt(props.view.startedAt) },
  ...(props.view.submittedAt
    ? [{ label: t('quiz.details.finished'), value: fmt(props.view.submittedAt) }]
    : []),
  ...(taken.value ? [{ label: t('quiz.details.taken'), value: taken.value }] : []),
]);
</script>

<template>
  <UiCard as="section" aria-labelledby="quiz-result" class="result">
    <UiConfetti v-if="passed && celebrate" />
    <UiBanner v-if="timeUp" tone="info" :title="t('quiz.timeUp.title')">
      {{ t('quiz.timeUp.body') }}
    </UiBanner>

    <div class="hero">
      <UiIcon :name="passed ? 'check-circle' : 'alert-circle'" :size="48" />
      <h1 id="quiz-result" class="ui-text-h2">
        {{ passed ? t('quiz.result.congrats') : t('quiz.result.sorry') }}
      </h1>
      <p class="ui-text-body">
        {{ passed ? t('quiz.result.passedBody') : t('quiz.result.failedBody') }}
      </p>
      <p class="score ui-text-h3">
        {{ t('quiz.result.score', { score: result.score, total: result.total }) }}
      </p>
      <p class="ui-text-caption ui-text-hint">
        {{ t('quiz.result.mark', { n: result.passPercent }) }}
      </p>
    </div>

    <UiBanner v-if="passed" tone="info" :title="t('quiz.reward.title')">
      {{ t('quiz.reward.body') }}
      <template #actions>
        <UiButton to="/me/rewards" size="xs">{{ t('quiz.reward.action') }}</UiButton>
      </template>
    </UiBanner>

    <p v-else class="ui-text-caption ui-text-hint hero__note">
      {{
        left > 0
          ? t(left === 1 ? 'quiz.retake.left.one' : 'quiz.retake.left', { n: left })
          : t('quiz.retake.none')
      }}
    </p>

    <div class="actions">
      <UiButton
        v-if="!passed && left > 0"
        size="xs"
        icon="refresh"
        :loading="retaking"
        :loading-label="t('quiz.saving')"
        @click="emit('retake')"
      >
        {{ t('quiz.retry') }}
      </UiButton>
      <UiButton to="/me" :variant="passed || left <= 0 ? 'primary' : 'secondary'" size="xs">
        {{ t('quiz.toDashboard') }}
      </UiButton>
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.toHome') }}</UiButton>
    </div>

    <UiAccordion :items="[{ id: 'details', title: t('quiz.details.title') }]">
      <template #item-details>
        <dl class="facts">
          <div v-for="row in rows" :key="row.label" class="facts__row">
            <dt class="ui-text-caption ui-text-hint">{{ row.label }}</dt>
            <dd class="ui-text-body">{{ row.value }}</dd>
          </div>
        </dl>
        <h2 class="ui-text-h3 answers__title">{{ t('quiz.details.answers') }}</h2>
        <ol class="answers">
          <li v-for="a in answers" :key="a.id">
            <span class="ui-text-label">{{ a.n }}. {{ a.prompt }}</span>
            <span class="ui-text-body">{{ t('quiz.details.yourAnswer', { a: a.answer }) }}</span>
          </li>
        </ol>
      </template>
    </UiAccordion>
  </UiCard>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2);
  text-align: center;
}
.hero h1,
.hero p,
.hero__note {
  margin: 0;
}
.hero__note {
  text-align: center;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--ui-space-2);
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
</style>
