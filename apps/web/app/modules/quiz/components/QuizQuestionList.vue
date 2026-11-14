<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import { answeredCount, listState } from '../logic';
import type { AttemptView } from '../types';

/**
 * Every question with where the participant stands: answered, current, flagged. Any question can be
 * opened, so people can skip a hard one and come back. The list keeps a fixed height and scrolls, so a
 * long quiz never pushes the page down.
 */
const props = defineProps<{
  view: Pick<AttemptView, 'questions' | 'answers'>;
  current: number;
  flagged: ReadonlySet<string>;
}>();
const emit = defineEmits<{ select: [index: number] }>();

const done = computed(() => answeredCount(props.view));
const pct = computed(() =>
  props.view.questions.length === 0 ? 0 : (done.value / props.view.questions.length) * 100,
);
</script>

<template>
  <UiCard as="section" aria-labelledby="quiz-list-title" class="list">
    <div class="list__head">
      <h2 id="quiz-list-title" class="ui-text-h3">{{ t('quiz.list.title') }}</h2>
      <p class="ui-text-caption ui-text-hint" role="status">
        {{ t('quiz.list.progress', { n: done, total: view.questions.length }) }}
      </p>
      <UiProgress
        :value="pct"
        :label="t('quiz.list.progress', { n: done, total: view.questions.length })"
      />
    </div>
    <ol class="list__items">
      <li v-for="(q, i) in view.questions" :key="q.id">
        <button
          type="button"
          class="item"
          :data-state="listState(q, i, current, view.answers)"
          :aria-current="i === current ? 'step' : undefined"
          @click="emit('select', i)"
        >
          <span class="item__label ui-text-body-s">{{ t('quiz.list.item', { n: i + 1 }) }}</span>
          <span class="item__marks">
            <UiIcon
              v-if="flagged.has(q.id)"
              name="star"
              :size="16"
              :label="t('quiz.list.flagged')"
            />
            <UiBadge v-if="i === current" tone="info" shape="pill">
              {{ t('quiz.list.current') }}
            </UiBadge>
            <UiIcon
              v-else-if="view.answers[q.id] !== undefined"
              name="check-circle"
              :size="18"
              :label="t('quiz.list.answered')"
            />
          </span>
        </button>
      </li>
    </ol>
  </UiCard>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.list__head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.list__head h2,
.list__head p {
  margin: 0;
}
.list__items {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  max-block-size: calc(var(--ui-space-12) * 6);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  inline-size: 100%;
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: var(--ui-space-1) var(--ui-space-3);
  background: transparent;
  color: var(--ui-color-text-primary);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.item[data-state='current'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border-color: var(--ui-color-action-primary);
}
.item[data-state='answered'] {
  background: var(--ui-color-surface-muted, transparent);
}
.item__marks {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-color-success-text);
}
</style>
