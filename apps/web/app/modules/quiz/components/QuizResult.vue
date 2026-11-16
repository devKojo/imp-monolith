<script setup lang="ts">
import { t } from '../../../i18n';
import type { AttemptResult } from '../types';

/** The outcome, as plain text with an icon (never colour alone). */
const props = defineProps<{
  result: AttemptResult;
  timeUp?: boolean;
  /** Which attempt this result is for, and how many the quiz allows. */
  attempt?: number;
  maxAttempts?: number;
  /** A retake is being started. */
  retaking?: boolean;
}>();
const emit = defineEmits<{ retake: [] }>();

const left = () => (props.maxAttempts ?? 1) - (props.attempt ?? 1);
</script>

<template>
  <UiCard as="section" aria-labelledby="quiz-result" class="result">
    <UiBanner v-if="timeUp" tone="info" :title="t('quiz.timeUp.title')">
      {{ t('quiz.timeUp.body') }}
    </UiBanner>
    <UiIcon :name="result.passed ? 'check-circle' : 'alert-circle'" :size="40" />
    <h1 id="quiz-result" class="ui-text-h2">
      {{ result.passed ? t('quiz.result.passed') : t('quiz.result.failed') }}
    </h1>
    <p class="ui-text-body">
      {{ t('quiz.result.score', { score: result.score, total: result.total }) }}
    </p>
    <p class="ui-text-caption ui-text-hint">
      {{ t('quiz.result.mark', { n: result.passPercent }) }}
    </p>
    <p v-if="(maxAttempts ?? 1) > 1" class="ui-text-caption ui-text-hint">
      {{ t('quiz.attempt.of', { n: attempt ?? 1, max: maxAttempts ?? 1 }) }} ·
      {{
        left() > 0
          ? t(left() === 1 ? 'quiz.retake.left.one' : 'quiz.retake.left', { n: left() })
          : t('quiz.retake.none')
      }}
    </p>
    <div class="actions">
      <UiButton
        v-if="left() > 0"
        size="xs"
        icon="refresh"
        :loading="retaking"
        :loading-label="t('quiz.saving')"
        @click="emit('retake')"
      >
        {{ t('quiz.retake') }}
      </UiButton>
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.result h1,
.result p {
  margin: 0;
}
</style>
