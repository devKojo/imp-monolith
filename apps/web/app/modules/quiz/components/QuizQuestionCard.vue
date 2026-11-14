<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import type { PublicQuestion } from '../types';

/**
 * One question at a time: the prompt, the options, and the way to move on. Choosing an option saves it
 * straight away (the page does the saving), so there is no separate "submit" to forget. The flag is a
 * private reminder kept in the browser; it is never sent anywhere.
 */
const props = defineProps<{
  question: PublicQuestion;
  index: number;
  total: number;
  /** Index of the chosen option, if any. */
  selected: number | undefined;
  flagged: boolean;
  saving: boolean;
}>();
const emit = defineEmits<{
  select: [choice: number];
  previous: [];
  next: [];
  flag: [];
  finish: [];
}>();

const options = computed(() =>
  props.question.options.map((label, i) => ({ value: String(i), label })),
);
const isLast = computed(() => props.index === props.total - 1);
</script>

<template>
  <UiCard as="section" aria-labelledby="quiz-question" class="card">
    <div class="card__meta">
      <UiBadge tone="info" shape="pill">
        {{ t('quiz.question.of', { n: index + 1, total }) }}
      </UiBadge>
      <UiButton
        variant="tertiary"
        size="xs"
        icon="star"
        :aria-pressed="flagged"
        @click="emit('flag')"
      >
        {{ flagged ? t('quiz.flagged') : t('quiz.flag') }}
      </UiButton>
    </div>

    <h1 id="quiz-question" class="ui-text-h2 card__prompt">{{ question.prompt }}</h1>

    <UiChoiceGroup
      :key="question.id"
      :model-value="selected === undefined ? '' : String(selected)"
      :legend="t('quiz.choose')"
      variant="cards"
      :options="options"
      @update:model-value="emit('select', Number($event))"
    />

    <div class="card__actions">
      <UiButton
        variant="secondary"
        size="xs"
        icon="chevron-left"
        :disabled="index === 0"
        @click="emit('previous')"
      >
        {{ t('quiz.previous') }}
      </UiButton>
      <UiButton v-if="isLast" size="xs" icon-trailing="arrow-right" @click="emit('finish')">
        {{ t('quiz.finish') }}
      </UiButton>
      <UiButton v-else size="xs" icon-trailing="arrow-right" @click="emit('next')">
        {{ t('quiz.next') }}
      </UiButton>
      <span v-if="saving" class="ui-text-caption ui-text-hint" role="status">
        {{ t('quiz.saving') }}
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
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.card__prompt {
  margin: 0;
}
.card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
</style>
