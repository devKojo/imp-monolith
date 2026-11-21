<script setup lang="ts">
import { t } from '../../../i18n';
import RewardWon from '../../rewards/components/RewardWon.vue';
import type { MyAward } from '../../rewards/types';

/**
 * Shown once the response is submitted (or when the person comes back to a finished survey). When the prizes
 * go to the first to finish and this person was one of them, it says so and offers to claim.
 */
defineProps<{ title: string; reward?: MyAward | null }>();
</script>

<template>
  <UiCard as="section" aria-labelledby="survey-done" class="done">
    <UiIcon name="check-circle" :size="40" />
    <h1 id="survey-done" class="ui-text-h2">{{ t('survey.done.title') }}</h1>
    <p class="ui-text-body">{{ t('survey.done.body', { title }) }}</p>
    <UiConfetti v-if="reward" />
    <section v-if="reward" class="won" aria-labelledby="survey-won">
      <RewardWon :reward="reward" heading-id="survey-won" />
    </section>
    <div class="actions">
      <UiButton to="/me" size="xs">{{ t('quiz.toDashboard') }}</UiButton>
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.toHome') }}</UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.done {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
}
.won {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  align-items: flex-start;
  inline-size: 100%;
  padding: var(--ui-space-4);
  background: var(--ui-color-selected-bg);
  border-radius: var(--ui-radius-lg);
}
.won h2,
.won p {
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
.done h1,
.done p {
  margin: 0;
}
</style>
