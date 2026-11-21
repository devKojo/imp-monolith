<script setup lang="ts">
import { computed } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { timeLeftText } from '../../discovery/logic';
import type { DiscoveryCampaign } from '../../discovery/types';

/**
 * The outcome of taking part, laid out like the quiz result so every campaign type ends the same way: a
 * header naming the campaign, a verdict with the facts that matter, what happens next, a short summary with
 * the details behind a disclosure, and one more campaign to try. Confetti bursts only when `celebrate` is
 * set, i.e. right after the person took part, not when they come back to the page. Each type supplies its own
 * words and numbers; the layout, the colours and the behaviour are shared. Meaning is never colour alone.
 */
export type ResultFact = { label: string; value: string; suffix?: string };

const props = defineProps<{
  /** Names the campaign type in the header badge, for example "Poll". */
  typeLabel: string;
  title: string;
  businessName?: string | undefined;
  /** A line under the title, for example when the person took part. */
  caption?: string | undefined;
  verdict: { badge: string; title: string; body: string };
  /** One or two big numbers beside the verdict. */
  headline: ResultFact[];
  nextTitle: string;
  nextBody: string;
  summaryTitle: string;
  tiles: ResultFact[];
  detailsTitle: string;
  details: ResultFact[];
  /** Another open campaign to suggest, if there is one. */
  next?: DiscoveryCampaign | null | undefined;
  /** Current time in ms, for the suggested campaign's countdown. */
  now?: number | undefined;
  /** Fire the confetti: true only right after taking part. */
  celebrate?: boolean | undefined;
}>();

const nextEnds = computed(() =>
  props.next
    ? {
        left: timeLeftText(props.next.endsAt, props.now ?? Date.now()),
        at: formatInZone(new Date(props.next.endsAt), props.next.timeZone),
      }
    : null,
);
</script>

<template>
  <div class="page">
    <UiConfetti v-if="celebrate" />

    <UiCard as="section" aria-labelledby="result-title" class="head">
      <div class="head__tags">
        <UiBadge shape="pill" tone="info">{{ typeLabel }}</UiBadge>
        <span v-if="businessName" class="ui-text-caption ui-text-hint">
          {{ t('quiz.result.by', { business: businessName }) }}
        </span>
      </div>
      <h1 id="result-title" class="head__title ui-text-h2">{{ title }}</h1>
      <p v-if="caption" class="ui-text-caption ui-text-hint head__meta">{{ caption }}</p>
    </UiCard>

    <UiCard as="section" aria-labelledby="result-verdict" class="verdict">
      <div class="verdict__main">
        <UiIconTile icon="check-circle" tone="success" />
        <div class="verdict__text">
          <UiBadge tone="success" icon="check-circle">{{ verdict.badge }}</UiBadge>
          <h2 id="result-verdict" class="ui-text-h1 verdict__title">{{ verdict.title }}</h2>
          <p class="ui-text-body-l verdict__body">{{ verdict.body }}</p>
        </div>
      </div>
      <dl class="score">
        <div v-for="h in headline" :key="h.label">
          <dt class="ui-text-caption ui-text-hint">{{ h.label }}</dt>
          <dd class="score__value">{{ h.value }}</dd>
          <dd v-if="h.suffix" class="ui-text-caption ui-text-hint">{{ h.suffix }}</dd>
        </div>
      </dl>
    </UiCard>

    <div class="grid">
      <UiCard as="section" aria-labelledby="result-next-step" class="next">
        <h2 id="result-next-step" class="ui-text-h3">{{ nextTitle }}</h2>
        <p class="ui-text-body">{{ nextBody }}</p>
        <slot name="actions" />
        <UiButton to="/me" variant="secondary">{{ t('quiz.toDashboard') }}</UiButton>
      </UiCard>

      <UiCard as="section" aria-labelledby="result-summary" class="perf">
        <h2 id="result-summary" class="ui-text-h3">{{ summaryTitle }}</h2>
        <div class="tiles">
          <UiStatCard
            v-for="x in tiles"
            :key="x.label"
            label-style="plain"
            :label="x.label"
            :value="x.value"
            :suffix="x.suffix ?? ''"
          />
        </div>
        <UiAccordion :items="[{ id: 'details', title: detailsTitle }]">
          <template #item-details>
            <dl class="facts">
              <div v-for="row in details" :key="row.label" class="facts__row">
                <dt class="ui-text-caption ui-text-hint">{{ row.label }}</dt>
                <dd class="ui-text-body">{{ row.value }}</dd>
              </div>
            </dl>
          </template>
        </UiAccordion>
      </UiCard>
    </div>

    <slot name="extra" />

    <section v-if="next" class="more" aria-labelledby="result-more">
      <div class="more__head">
        <div>
          <h2 id="result-more" class="ui-text-h2">{{ t('quiz.next.title') }}</h2>
          <p class="ui-text-body hint">{{ t('quiz.next.subtitle') }}</p>
        </div>
        <UiLink to="/discover">{{ t('quiz.next.all') }}</UiLink>
      </div>
      <UiCard class="more__card">
        <div class="more__text">
          <div class="head__tags">
            <UiBadge shape="pill" tone="info">{{ t(`type.${next.type}.one` as never) }}</UiBadge>
            <span class="ui-text-caption ui-text-hint">
              {{ t('quiz.result.by', { business: next.businessName }) }}
            </span>
          </div>
          <h3 class="ui-text-h3">{{ next.title }}</h3>
          <p v-if="next.summary" class="ui-text-body hint">{{ next.summary }}</p>
          <p v-if="nextEnds" class="ui-text-caption ui-text-hint">
            {{ nextEnds.left }} · {{ nextEnds.at }}
          </p>
        </div>
        <UiButton :to="`/c/${next.slug}`" icon="arrow-right">{{ t('quiz.next.action') }}</UiButton>
      </UiCard>
    </section>

    <nav class="back" :aria-label="t('quiz.back.label')">
      <UiLink to="/me">{{ t('quiz.toDashboard') }}</UiLink>
      <UiLink to="/discover">{{ t('quiz.toHome') }}</UiLink>
    </nav>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}
.head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.head__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.head__title,
.head__meta,
.verdict__title,
.verdict__body {
  margin: 0;
}
.verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-6);
}
.verdict__main {
  display: flex;
  flex: 1 1 22rem;
  align-items: flex-start;
  gap: var(--ui-space-4);
}
.verdict__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-2);
}
.verdict__body {
  color: var(--ui-color-text-secondary);
}
.score {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-6);
  margin: 0;
  padding: var(--ui-space-4) var(--ui-space-6);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-color-surface-page);
}
.score dd {
  margin: 0;
}
.score__value {
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  color: var(--ui-color-action-primary);
  overflow-wrap: anywhere;
}
.grid {
  display: grid;
  gap: var(--ui-space-6);
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .grid {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    align-items: start;
  }
}
.next,
.perf {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-3);
}
.next h2,
.next p,
.perf h2 {
  margin: 0;
}
.perf {
  align-items: stretch;
}
.tiles {
  display: grid;
  gap: var(--ui-space-3);
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}
.facts {
  display: grid;
  gap: var(--ui-space-2);
  margin: 0;
}
.facts__row {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.facts dd {
  margin: 0;
  text-align: end;
  overflow-wrap: anywhere;
}
.more {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.more__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.more__head h2,
.more__head p {
  margin: 0;
}
.hint {
  color: var(--ui-color-text-secondary);
}
.more__card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.more__text {
  display: flex;
  flex: 1 1 20rem;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.more__text h3,
.more__text p {
  margin: 0;
}
.back {
  display: flex;
  justify-content: center;
  gap: var(--ui-space-6);
}
</style>
