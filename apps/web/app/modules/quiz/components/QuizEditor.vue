<script setup lang="ts">
import { ref, watch } from 'vue';
import { t, type AppTextKey } from '../../../i18n';
import {
  LIMITS,
  addAnswer,
  addQuestion,
  moveQuestion,
  newQuestion,
  parsePassPercent,
  parseTimeLimit,
  questionProblem,
  removeAnswer,
  removeQuestion,
  setAnswer,
  updateQuestion,
} from '../logic';
import type { QuestionDraft, QuizDraft } from '../types';

/**
 * Where a business writes the questions of a quiz: the text, two to six answers, and which one is
 * correct. The page owns the data; every change goes up as a whole new draft. `showProblems` turns on
 * the inline explanations after a failed save, so a question you have only just added is not
 * scolded before you have typed anything.
 */
const props = defineProps<{
  modelValue: QuizDraft;
  readonly?: boolean;
  showProblems?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [quiz: QuizDraft] }>();

const set = (patch: Partial<QuizDraft>) =>
  emit('update:modelValue', { ...props.modelValue, ...patch });
const setQuestions = (questions: QuestionDraft[]) => set({ questions });
const patch = (q: QuestionDraft, p: Partial<Omit<QuestionDraft, 'uid'>>) =>
  setQuestions(updateQuestion(props.modelValue.questions, q.uid, p));
const replace = (next: QuestionDraft) =>
  setQuestions(props.modelValue.questions.map((q) => (q.uid === next.uid ? next : q)));

// The number fields keep what is typed; the quiz only takes a value once it is a valid one.
const timeText = ref(String(props.modelValue.timeLimitMinutes ?? ''));
const passText = ref(String(props.modelValue.passPercent));
watch(
  () => props.modelValue.timeLimitMinutes,
  (v) => parseTimeLimit(timeText.value) !== v && (timeText.value = String(v ?? '')),
);
watch(
  () => props.modelValue.passPercent,
  (v) => parsePassPercent(passText.value, -1) !== v && (passText.value = String(v)),
);
const onTime = (text: string) => {
  timeText.value = text;
  set({ timeLimitMinutes: parseTimeLimit(text) });
};
const onPass = (text: string) => {
  passText.value = text;
  set({ passPercent: parsePassPercent(text, props.modelValue.passPercent) });
};

const add = () =>
  setQuestions(addQuestion(props.modelValue.questions, newQuestion(crypto.randomUUID())));
const problemOf = (q: QuestionDraft) => (props.showProblems ? questionProblem(q) : null);
</script>

<template>
  <UiCard as="section" aria-labelledby="quiz-editor-title" class="editor">
    <div class="editor__head">
      <h2 id="quiz-editor-title" class="ui-text-h3">{{ t('quiz.builder.title') }}</h2>
      <p class="ui-text-caption ui-text-hint">
        {{ readonly ? t('quiz.builder.locked') : t('quiz.builder.hint') }}
      </p>
    </div>

    <div class="settings">
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
    </div>

    <p v-if="modelValue.questions.length === 0" class="ui-text-caption ui-text-hint">
      {{ t('quiz.builder.empty') }}
    </p>

    <ol class="questions">
      <li v-for="(q, i) in modelValue.questions" :key="q.uid" class="question">
        <div class="question__head">
          <h3 class="ui-text-label">{{ t('quiz.q.title', { n: i + 1 }) }}</h3>
          <div v-if="!readonly" class="question__tools">
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-up"
              :disabled="i === 0"
              @click="setQuestions(moveQuestion(modelValue.questions, q.uid, -1))"
            >
              <span class="ui-sr-only">{{ t('quiz.q.up', { n: i + 1 }) }}</span>
            </UiButton>
            <UiButton
              variant="tertiary"
              size="xs"
              icon="arrow-down"
              :disabled="i === modelValue.questions.length - 1"
              @click="setQuestions(moveQuestion(modelValue.questions, q.uid, 1))"
            >
              <span class="ui-sr-only">{{ t('quiz.q.down', { n: i + 1 }) }}</span>
            </UiButton>
            <UiButton
              variant="tertiary"
              size="xs"
              icon="trash"
              @click="setQuestions(removeQuestion(modelValue.questions, q.uid))"
            >
              <span class="ui-sr-only">{{ t('quiz.q.remove', { n: i + 1 }) }}</span>
            </UiButton>
          </div>
        </div>

        <UiTextInput
          :id="`quiz-prompt-${q.uid}`"
          :model-value="q.prompt"
          :label="t('quiz.q.prompt')"
          :maxlength="LIMITS.prompt"
          :readonly="readonly"
          @update:model-value="patch(q, { prompt: $event })"
        />

        <ol class="answers">
          <li v-for="(option, a) in q.options" :key="a" class="answer">
            <UiButton
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
              :id="`quiz-answer-${q.uid}-${a}`"
              class="answer__input"
              :model-value="option"
              :label="t('quiz.q.answer', { n: a + 1 })"
              hide-label
              :maxlength="LIMITS.option"
              :readonly="readonly"
              @update:model-value="replace(setAnswer(q, a, $event))"
            />
            <UiButton
              v-if="!readonly"
              variant="tertiary"
              size="xs"
              icon="x"
              :disabled="q.options.length <= LIMITS.optionsMin"
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
          :disabled="q.options.length >= LIMITS.optionsMax"
          @click="replace(addAnswer(q))"
        >
          {{ t('quiz.q.addAnswer') }}
        </UiButton>

        <p v-if="problemOf(q)" class="ui-text-caption problem" role="alert">
          <UiIcon name="alert-triangle" :size="14" />
          {{ t(`quiz.q.problem.${problemOf(q)}` as AppTextKey) }}
        </p>
      </li>
    </ol>

    <div v-if="!readonly" class="editor__add">
      <UiButton
        variant="secondary"
        size="xs"
        icon="plus"
        :disabled="modelValue.questions.length >= LIMITS.questions"
        @click="add"
      >
        {{ t('quiz.builder.add') }}
      </UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.editor__head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.editor__head h2,
.editor__head p {
  margin: 0;
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
.questions,
.answers {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
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
.question > :deep(*) {
  max-inline-size: 100%;
}
.question__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
}
.question__head h3 {
  margin: 0;
}
.question__tools {
  display: flex;
  gap: var(--ui-space-1);
}
.question > :deep(.ui-field),
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
