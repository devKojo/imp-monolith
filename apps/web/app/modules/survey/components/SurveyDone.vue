<script setup lang="ts">
import { t } from '../../../i18n';

/** Shown once the response is submitted (or when the person comes back to a finished survey). */
defineProps<{ title: string }>();
</script>

<template>
  <UiCard as="section" aria-labelledby="survey-done" class="done">
    <UiIcon name="check-circle" :size="40" />
    <h1 id="survey-done" class="ui-text-h2">{{ t('survey.done.title') }}</h1>
    <p class="ui-text-body">{{ t('survey.done.body', { title }) }}</p>
    <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
  </UiCard>
</template>

<style scoped>
.done {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
}
.done h1,
.done p {
  margin: 0;
}
</style>
