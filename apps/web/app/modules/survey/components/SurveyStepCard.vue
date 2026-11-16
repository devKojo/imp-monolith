<script setup lang="ts">
import { computed } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import type { Step } from '../logic';
import { LIKERT_POINTS, type Answers } from '../types';

/**
 * One screen of the survey: a single question, or a matrix of ratings on a shared scale. Choosing an
 * option saves it straight away and written answers save when the field is left or the screen changes
 * (the page does the saving), so there is no separate "save" to forget. Enter moves on, except inside a
 * written answer where it keeps its meaning.
 */
const props = defineProps<{
  step: Step;
  index: number;
  total: number;
  answers: Answers;
  /** Required questions the participant tried to skip, shown as errors on those questions. */
  missing: readonly string[];
  saving: boolean;
}>();
const emit = defineEmits<{
  choose: [questionId: string, choiceIndex: number];
  write: [questionId: string, text: string];
  leave: [questionId: string];
  previous: [];
  next: [];
  finish: [];
}>();

const isLast = computed(() => props.index === props.total - 1);
const first = computed(() => props.step.questions[0]!);
const anyRequired = computed(() => props.step.questions.some((q) => q.required));

const scale = Array.from({ length: LIKERT_POINTS }, (_, i) =>
  t(`survey.scale.${i + 1}` as AppTextKey),
);
const rows = computed(() =>
  props.step.questions.map((q) => ({
    id: q.id,
    label: q.required ? `${q.prompt} ${t('survey.required.suffix')}` : q.prompt,
  })),
);
const ratings = computed(() => {
  const out: Record<string, number | undefined> = {};
  for (const q of props.step.questions) out[q.id] = props.answers[q.id]?.choiceIndex;
  return out;
});

const choices = computed(() =>
  first.value.options.map((label, i) => ({ value: String(i), label })),
);
const chosen = computed(() => {
  const i = props.answers[first.value.id]?.choiceIndex;
  return i === undefined ? '' : String(i);
});
const text = computed(() => props.answers[first.value.id]?.text ?? '');
const fieldError = computed(() =>
  props.missing.includes(first.value.id) ? t('survey.question.required') : undefined,
);
const matrixError = computed(() => props.step.questions.some((q) => props.missing.includes(q.id)));

const kicker = computed(() =>
  props.step.kind === 'matrix'
    ? t('survey.kind.likert')
    : t(`survey.kind.${first.value.kind}` as AppTextKey),
);

function onEnter(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'A') return;
  e.preventDefault();
  if (isLast.value) emit('finish');
  else emit('next');
}
</script>

<template>
  <UiCard as="section" aria-labelledby="survey-question" class="card" @keydown.enter="onEnter">
    <div class="card__meta">
      <UiBadge tone="info" shape="pill">
        {{ t('survey.step.of', { n: index + 1, total }) }}
      </UiBadge>
      <UiBadge shape="pill">{{ kicker }}</UiBadge>
      <UiBadge v-if="anyRequired" tone="warning" shape="pill">{{ t('survey.required') }}</UiBadge>
    </div>

    <template v-if="step.kind === 'matrix'">
      <h1 id="survey-question" class="ui-text-h2 card__prompt">{{ t('survey.matrix.title') }}</h1>
      <p class="ui-text-body ui-text-hint card__helper">{{ t('survey.matrix.body') }}</p>
      <UiBanner v-if="matrixError" tone="error" role="alert">
        {{ t('survey.matrix.required') }}
      </UiBanner>
      <UiRatingMatrix
        :legend="t('survey.matrix.title')"
        :statement-label="t('survey.matrix.statement')"
        :scale="scale"
        :rows="rows"
        :model-value="ratings"
        @select="(id, i) => emit('choose', id, i)"
      />
      <p class="ui-text-caption ui-text-hint">{{ t('survey.matrix.tip', { n: LIKERT_POINTS }) }}</p>
    </template>

    <template v-else>
      <h1 id="survey-question" class="ui-text-h2 card__prompt">{{ first.prompt }}</h1>
      <p v-if="first.helper" class="ui-text-body ui-text-hint card__helper">{{ first.helper }}</p>

      <UiChoiceGroup
        v-if="first.kind === 'choice'"
        :key="first.id"
        :model-value="chosen"
        :legend="t('survey.choose')"
        variant="cards"
        :options="choices"
        :error="fieldError"
        @update:model-value="emit('choose', first.id, Number($event))"
      />
      <UiTextInput
        v-else
        :key="first.id"
        :model-value="text"
        :label="first.prompt"
        hide-label
        multiline
        :rows="first.kind === 'long_text' ? 7 : 3"
        :maxlength="first.kind === 'long_text' ? 4000 : 500"
        :error="fieldError"
        @update:model-value="emit('write', first.id, $event)"
        @focusout="emit('leave', first.id)"
      />
    </template>

    <div class="card__actions">
      <UiButton
        variant="secondary"
        size="xs"
        icon="chevron-left"
        :disabled="index === 0"
        @click="emit('previous')"
      >
        {{ t('survey.previous') }}
      </UiButton>
      <UiButton v-if="isLast" size="xs" icon-trailing="arrow-right" @click="emit('finish')">
        {{ t('survey.finish') }}
      </UiButton>
      <UiButton v-else size="xs" icon-trailing="arrow-right" @click="emit('next')">
        {{ t('survey.next') }}
      </UiButton>
      <span class="card__saved ui-text-caption ui-text-hint" role="status">
        {{ saving ? t('survey.saving') : t('survey.saved') }}
      </span>
    </div>
  </UiCard>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
}
.card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.card__prompt,
.card__helper {
  margin: 0;
}
.card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.card__saved {
  margin-inline-start: auto;
}
</style>
