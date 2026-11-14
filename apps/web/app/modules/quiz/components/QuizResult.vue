<script setup lang="ts">
import { t } from '../../../i18n';
import type { AttemptResult } from '../types';

/** The outcome, as plain text with an icon (never colour alone). */
defineProps<{ result: AttemptResult; timeUp?: boolean }>();
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
    <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
  </UiCard>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
}
.result h1,
.result p {
  margin: 0;
}
</style>
