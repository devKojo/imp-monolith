<script setup lang="ts">
import { computed, useId } from 'vue';
import { t } from '../../../i18n';
import { leader, resultFor } from '../logic';
import type { BallotOption, Results } from '../types';

/**
 * How a poll or an image vote stands: one row per option with its share and count. The leader is marked and
 * so is the participant's own vote, so colour is never the only cue. Read-only.
 */
const props = defineProps<{
  options: BallotOption[];
  results: Results;
  /** The option the signed-in participant voted for, if any. */
  yours?: number | null;
  /** The question these standings answer, when a ballot has several; replaces the generic title. */
  heading?: string;
}>();
const titleId = useId();

const top = computed(() => leader(props.results));
const total = computed(() =>
  props.results.total === 1
    ? t('ballot.results.total.one')
    : t('ballot.results.total', { n: props.results.total.toLocaleString() }),
);
</script>

<template>
  <section class="results" :aria-labelledby="titleId">
    <div class="results__head">
      <h2 :id="titleId" class="ui-text-h3">{{ heading || t('ballot.results.title') }}</h2>
      <p class="ui-text-caption ui-text-hint" role="status">{{ total }}</p>
    </div>
    <ul class="results__rows">
      <li v-for="o in options" :key="o.index" class="row" :data-leader="top === o.index">
        <div class="row__top">
          <span class="row__label ui-text-label">
            {{ o.label }}
            <UiBadge v-if="yours === o.index" tone="info" shape="pill">{{
              t('ballot.results.yours')
            }}</UiBadge>
          </span>
          <span class="row__value ui-text-label">
            {{
              t('ballot.results.value', {
                percent: resultFor(results, o.index).percent,
                votes: resultFor(results, o.index).votes.toLocaleString(),
              })
            }}
          </span>
        </div>
        <UiProgress
          :value="resultFor(results, o.index).percent"
          :label="t('ballot.results.label', { name: o.label })"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.results {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.results h2,
.results p {
  margin: 0;
}
.results__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.results__rows {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.row__top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.row__label {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
.row[data-leader='true'] .row__label,
.row[data-leader='true'] .row__value {
  font-weight: 700;
}
</style>
