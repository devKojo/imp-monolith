<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import {
  FIELD_LIMITS,
  addAnswer,
  addField,
  addable,
  ballotSettingsOf,
  fieldProblem,
  fieldsOf,
  hasOptions,
  isHttpsLink,
  maxLabel,
  maxOptions,
  moveField,
  newField,
  parseMaxAttempts,
  parsePassPercent,
  parseTimeLimit,
  quizSettingsOf,
  removeAnswer,
  removeField,
  setAnswer,
  updateField,
  type FieldProblem,
} from '../fields';
import type {
  CampaignField,
  CampaignSettings,
  FieldKind,
  ResultsVisibility,
  TemplateRef,
} from '../types';

/**
 * Where a business writes what its campaign contains, from the fields its type allows: what a participant
 * is asked about themselves, and the questions (for a quiz, with the correct answer marked), plus the quiz
 * settings. The page owns the data; every change goes up as a whole new list. `showProblems` turns on the
 * inline explanations after a failed save or launch, so a question you have only just added is not scolded
 * before you have typed anything.
 */
const props = defineProps<{
  template: TemplateRef | null;
  fields: CampaignField[];
  settings: CampaignSettings;
  readonly?: boolean;
  showProblems?: boolean;
}>();
const emit = defineEmits<{
  'update:fields': [fields: CampaignField[]];
  'update:settings': [settings: CampaignSettings];
}>();

const setFields = (next: CampaignField[]) => emit('update:fields', next);
const patch = (f: CampaignField, p: Partial<Omit<CampaignField, 'id' | 'kind'>>) =>
  setFields(updateField(props.fields, f.id, p));
const replace = (next: CampaignField) =>
  setFields(props.fields.map((f) => (f.id === next.id ? next : f)));
const add = (kind: FieldKind) =>
  setFields(addField(props.fields, newField(kind, props.template, crypto.randomUUID())));

const openDetails = ref(true);
const openQuestions = ref(true);
const count = (n: number, one: AppTextKey, many: AppTextKey) => (n === 1 ? t(one) : t(many, { n }));

const details = computed(() => fieldsOf(props.fields, 'details'));
const questions = computed(() => fieldsOf(props.fields, 'content'));
const addableDetails = computed(() => addable(props.template, props.fields, 'details'));
const addableContent = computed(() => addable(props.template, props.fields, 'content'));
/** Whether this type has content (questions) at all, even when the limit has been reached. */
const hasContent = computed(() => props.template?.fields.some((a) => a.group === 'content'));
const isQuiz = computed(() => props.template?.archetype === 'quiz');
const isPoll = computed(() => props.template?.archetype === 'poll');
const isVote = computed(() => props.template?.archetype === 'vote');
const isBallot = computed(() => isPoll.value || isVote.value);
const archetype = computed(() => props.template?.archetype);
const questionsTitle = computed(() =>
  t(isVote.value ? 'vote.builder.title' : isPoll.value ? 'poll.builder.title' : 'cmp.questions'),
);

const kindLabel = (kind: FieldKind) => t(`cmp.field.kind.${kind}` as AppTextKey);
const addLabel = (kind: FieldKind) => t('cmp.field.add', { kind: kindLabel(kind).toLowerCase() });
// Problems show after a save attempt. A picture link that has been typed but is not valid shows at once,
// because the Launch button stays off until it is fixed and nothing else would say why.
const problemOf = (f: CampaignField): FieldProblem | null => {
  const problem = fieldProblem(f);
  const typedBadLink =
    f.kind === 'candidate' && problem === 'image' && (f.imageUrl ?? '').trim() !== '';
  return props.showProblems || typedBadLink ? problem : null;
};
const problemText = (f: CampaignField, problem: FieldProblem) =>
  problem === 'image'
    ? t('vote.candidate.problem.image')
    : f.kind === 'candidate' && problem === 'label'
      ? t('vote.candidate.problem.name')
      : f.kind === 'quiz_question' || problem !== 'label'
        ? t(`quiz.q.problem.${problem === 'label' ? 'prompt' : problem}` as AppTextKey)
        : t('cmp.field.problem.label');

// The quiz number fields keep what is typed; the settings only take a value once it is a valid one.
const quiz = computed(() => quizSettingsOf(props.settings));
const timeText = ref(String(quiz.value.timeLimitMinutes ?? ''));
const passText = ref(String(quiz.value.passPercent));
const attemptOptions = Array.from({ length: FIELD_LIMITS.maxAttemptsMax }, (_, i) => ({
  value: String(i + 1),
  label:
    i === 0 ? t('quiz.settings.attempts.one') : t('quiz.settings.attempts.other', { n: i + 1 }),
}));
watch(
  () => quiz.value.timeLimitMinutes,
  (v) => parseTimeLimit(timeText.value) !== v && (timeText.value = String(v ?? '')),
);
watch(
  () => quiz.value.passPercent,
  (v) => parsePassPercent(passText.value, -1) !== v && (passText.value = String(v)),
);
// Poll and image vote: when people may see how it stands.
const ballot = computed(() => ballotSettingsOf(props.settings));
const resultsOptions: Array<{ value: ResultsVisibility; label: string }> = [
  { value: 'after_vote', label: t('ballot.settings.results.after') },
  { value: 'live', label: t('ballot.settings.results.live') },
];
const onResults = (value: string) =>
  emit('update:settings', {
    ballot: { showResults: value === 'live' ? 'live' : 'after_vote' },
  });
const imageOk = (f: CampaignField) => isHttpsLink(f.imageUrl ?? '');

const setQuiz = (p: Partial<typeof quiz.value>) =>
  emit('update:settings', { quiz: { ...quiz.value, ...p } });
const onTime = (text: string) => {
  timeText.value = text;
  setQuiz({ timeLimitMinutes: parseTimeLimit(text) });
};
const onAttempts = (text: string) =>
  setQuiz({ maxAttempts: parseMaxAttempts(text, quiz.value.maxAttempts) });
const onPass = (text: string) => {
  passText.value = text;
  setQuiz({ passPercent: parsePassPercent(text, quiz.value.passPercent) });
};
</script>

<template>
  <div class="content">
    <UiCollapsible
      v-model:open="openDetails"
      :title="t('cmp.details')"
      :summary="count(details.length, 'cmp.details.summary.one', 'cmp.details.summary')"
     
    >
      <p class="ui-text-caption ui-text-hint block__hint">{{ t('cmp.details.hint') }}</p>

      <p v-if="!template" class="ui-text-caption ui-text-hint">{{ t('cmp.content.noType') }}</p>
      <ul v-else class="rows">
        <li v-for="f in details" :key="f.id" class="detail">
          <span class="detail__kind ui-text-label-sm">{{ kindLabel(f.kind) }}</span>
          <UiTextInput
            :id="`field-label-${f.id}`"
            class="detail__label"
            :model-value="f.label"
            :label="t('cmp.field.label')"
            hide-label
            :maxlength="maxLabel(f.kind)"
            :readonly="readonly"
            :error="problemOf(f) ? problemText(f, problemOf(f)!) : undefined"
            @update:model-value="patch(f, { label: $event })"
          />
          <UiCheckbox
            :id="`field-required-${f.id}`"
            :model-value="f.required"
            :label="t('cmp.field.required')"
            :disabled="readonly"
            @update:model-value="patch(f, { required: $event })"
          />
          <UiButton
            v-if="!readonly"
            variant="tertiary"
            size="xs"
            icon="trash"
            @click="setFields(removeField(fields, f.id))"
          >
            <span class="ui-sr-only">{{ t('cmp.field.remove', { item: kindLabel(f.kind) }) }}</span>
          </UiButton>
        </li>
      </ul>

      <div v-if="!readonly && addableDetails.length > 0" class="adds">
        <UiButton
          v-for="a in addableDetails"
          :key="a.kind"
          variant="secondary"
          size="xs"
          icon="plus"
          @click="add(a.kind)"
        >
          {{ addLabel(a.kind) }}
        </UiButton>
      </div>
    </UiCollapsible>

    <UiCollapsible
      v-if="hasContent"
      v-model:open="openQuestions"
      :title="questionsTitle"
      :summary="
        isVote
          ? count(questions.length, 'cmp.candidates.summary.one', 'cmp.candidates.summary')
          : count(questions.length, 'cmp.questions.summary.one', 'cmp.questions.summary')
      "
     
    >
      <p class="ui-text-caption ui-text-hint block__hint">
        {{
          readonly
            ? t('quiz.builder.locked')
            : isQuiz
              ? t('quiz.builder.hint')
              : isVote
                ? t('vote.builder.hint')
                : isPoll
                  ? t('poll.builder.hint')
                  : t('cmp.questions.hint')
        }}
      </p>

      <div v-if="isQuiz" class="settings">
        <UiTextInput
          id="quiz-time"
          type="number"
          inputmode="numeric"
          :model-value="timeText"
          :label="t('quiz.settings.time')"
          :hint="t('quiz.settings.timeHint')"
          :readonly="readonly"
          @update:model-value="onTime"
        />
        <UiTextInput
          id="quiz-pass"
          type="number"
          inputmode="numeric"
          :model-value="passText"
          :label="t('quiz.settings.pass')"
          :readonly="readonly"
          @update:model-value="onPass"
        />
        <UiSelect
          id="quiz-attempts"
          :model-value="String(quiz.maxAttempts)"
          :label="t('quiz.settings.attempts')"
          :hint="t('quiz.settings.attemptsHint')"
          :options="attemptOptions"
          :disabled="readonly"
          @update:model-value="onAttempts"
        />
      </div>

      <div v-if="isBallot" class="settings">
        <UiSelect
          id="ballot-results"
          :model-value="ballot.showResults"
          :label="t('ballot.settings.results')"
          :hint="t('ballot.settings.resultsHint')"
          :options="resultsOptions"
          :disabled="readonly"
          @update:model-value="onResults"
        />
      </div>

      <p v-if="questions.length === 0" class="ui-text-caption ui-text-hint">
        {{
          isVote ? t('vote.builder.empty') : isPoll ? t('poll.builder.empty') : t('quiz.builder.empty')
        }}
      </p>

      <ol class="questions">
        <li v-for="(q, i) in questions" :key="q.id" class="question">
          <div class="question__head">
            <h3 class="ui-text-label">
              {{
                t(q.kind === 'candidate' ? 'vote.candidate.title' : 'quiz.q.title', { n: i + 1 })
              }}
              <UiBadge v-if="!isQuiz && !isBallot" shape="pill">{{ kindLabel(q.kind) }}</UiBadge>
            </h3>
            <div v-if="!readonly" class="question__tools">
              <UiButton
                variant="tertiary"
                size="xs"
                icon="arrow-up"
                :disabled="i === 0"
                @click="setFields(moveField(fields, q.id, -1))"
              >
                <span class="ui-sr-only">{{ t('quiz.q.up', { n: i + 1 }) }}</span>
              </UiButton>
              <UiButton
                variant="tertiary"
                size="xs"
                icon="arrow-down"
                :disabled="i === questions.length - 1"
                @click="setFields(moveField(fields, q.id, 1))"
              >
                <span class="ui-sr-only">{{ t('quiz.q.down', { n: i + 1 }) }}</span>
              </UiButton>
              <UiButton
                variant="tertiary"
                size="xs"
                icon="trash"
                @click="setFields(removeField(fields, q.id))"
              >
                <span class="ui-sr-only">{{ t('quiz.q.remove', { n: i + 1 }) }}</span>
              </UiButton>
            </div>
          </div>

          <UiTextInput
            :id="`question-prompt-${q.id}`"
            class="question__prompt"
            :model-value="q.label"
            :label="q.kind === 'candidate' ? t('vote.candidate.name') : t('quiz.q.prompt')"
            :maxlength="FIELD_LIMITS.prompt"
            :readonly="readonly"
            @update:model-value="patch(q, { label: $event })"
          />

          <template v-if="q.kind === 'candidate'">
            <UiTextInput
              :id="`candidate-description-${q.id}`"
              class="question__prompt"
              :model-value="q.helper"
              :label="t('vote.candidate.description')"
              :maxlength="FIELD_LIMITS.helper"
              :readonly="readonly"
              @update:model-value="patch(q, { helper: $event })"
            />
            <UiTextInput
              :id="`candidate-image-${q.id}`"
              class="question__prompt"
              type="url"
              :model-value="q.imageUrl ?? ''"
              :label="t('vote.candidate.image')"
              :hint="t('vote.candidate.imageHint')"
              :maxlength="FIELD_LIMITS.imageUrl"
              :readonly="readonly"
              @update:model-value="patch(q, { imageUrl: $event })"
            />
            <img
              v-if="imageOk(q)"
              class="question__image"
              :src="(q.imageUrl ?? '').trim()"
              :alt="t('vote.candidate.imageAlt', { name: q.label || String(i + 1) })"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </template>

          <template v-if="hasOptions(q.kind)">
            <ol class="answers">
              <li v-for="(option, a) in q.options" :key="a" class="answer">
                <UiButton
                  v-if="q.kind === 'quiz_question'"
                  :variant="q.correctIndex === a ? 'primary' : 'secondary'"
                  size="xs"
                  icon="check-circle"
                  :aria-pressed="q.correctIndex === a"
                  :disabled="readonly"
                  @click="patch(q, { correctIndex: a })"
                >
                  <span class="ui-sr-only">{{ t('quiz.q.markCorrect', { n: a + 1 }) }}</span>
                </UiButton>
                <UiTextInput
                  :id="`answer-${q.id}-${a}`"
                  class="answer__input"
                  :model-value="option"
                  :label="t('quiz.q.answer', { n: a + 1 })"
                  hide-label
                  :maxlength="FIELD_LIMITS.option"
                  :readonly="readonly"
                  @update:model-value="replace(setAnswer(q, a, $event))"
                />
                <UiButton
                  v-if="!readonly"
                  variant="tertiary"
                  size="xs"
                  icon="x"
                  :disabled="q.options.length <= FIELD_LIMITS.optionsMin"
                  @click="replace(removeAnswer(q, a))"
                >
                  <span class="ui-sr-only">{{ t('quiz.q.removeAnswer', { n: a + 1 }) }}</span>
                </UiButton>
              </li>
            </ol>
            <UiButton
              v-if="!readonly"
              variant="secondary"
              size="xs"
              icon="plus"
              :disabled="q.options.length >= maxOptions(q.kind, archetype)"
              @click="replace(addAnswer(q, archetype))"
            >
              {{ t('quiz.q.addAnswer') }}
            </UiButton>
          </template>

          <UiCheckbox
            v-if="q.kind !== 'quiz_question' && q.kind !== 'candidate' && !isPoll"
            :id="`question-required-${q.id}`"
            :model-value="q.required"
            :label="t('cmp.field.required')"
            :disabled="readonly"
            @update:model-value="patch(q, { required: $event })"
          />

          <p v-if="problemOf(q)" class="ui-text-caption problem" role="alert">
            <UiIcon name="alert-triangle" :size="14" />
            {{ problemText(q, problemOf(q)!) }}
          </p>
        </li>
      </ol>

      <div v-if="!readonly && addableContent.length > 0" class="adds">
        <UiButton
          v-for="a in addableContent"
          :key="a.kind"
          variant="secondary"
          size="xs"
          icon="plus"
          @click="add(a.kind)"
        >
          {{
            a.kind === 'quiz_question'
              ? t('quiz.builder.add')
              : a.kind === 'candidate'
                ? t('vote.builder.add')
                : isPoll
                  ? t('poll.builder.add')
                  : addLabel(a.kind)
          }}
        </UiButton>
      </div>
    </UiCollapsible>
  </div>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.block__hint {
  margin: 0;
}
.rows,
.questions,
.answers {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-2);
  align-items: center;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
@media (min-width: 640px) {
  .detail {
    grid-template-columns: calc(var(--ui-space-12) * 3) minmax(0, 1fr) auto auto;
  }
}
.detail__kind {
  color: var(--ui-color-text-secondary);
}
.detail__label {
  min-inline-size: 0;
}
.adds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.settings {
  display: grid;
  gap: var(--ui-space-4);
}
@media (min-width: 640px) {
  .settings {
    grid-template-columns: 1fr 1fr;
  }
}
.question {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.question__image {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 5);
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.question__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
}
.question__head h3 {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin: 0;
}
.question__tools {
  display: flex;
  gap: var(--ui-space-1);
}
.question__prompt,
.answers {
  inline-size: 100%;
}
.answer {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.answer__input {
  flex: 1;
  min-inline-size: 0;
}
.problem {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  margin: 0;
  color: var(--ui-color-danger-text, var(--ui-color-warning-text));
}
</style>
