<script setup lang="ts">
import { computed } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import ParticipantPreview from '../../templates/components/ParticipantPreview.vue';
import type { TemplateBlock } from '../../templates/types';
import { winnersLabelKey } from '../logic';
import type { Prize } from '../types';

/**
 * What participants will see, built from the same fields: the closing time, the headline and text, the
 * prize tiers and the entry form from the template. Structure follows the campaign page design; it
 * says only what the campaign says, nothing about verification or payouts the platform does not do.
 * The form is inert (see ParticipantPreview).
 */
const props = defineProps<{
  title: string;
  summary: string;
  endAt: string | null;
  prizes: Prize[];
  /** Short label above the headline, for example the kind of campaign. */
  kicker: string;
  blocks: TemplateBlock[];
  hasTemplate: boolean;
  zone: string;
  device: 'mobile' | 'desktop';
}>();

const closes = computed(() =>
  props.endAt
    ? t('cmp.preview.closes', { when: formatInZone(new Date(props.endAt), props.zone) })
    : t('cmp.preview.noClose'),
);
const headline = computed(() => props.title || t('cmp.preview.headline'));
</script>

<template>
  <article class="page" :data-device="device">
    <p class="bar ui-text-caption">{{ closes }}</p>

    <header class="hero">
      <p v-if="kicker" class="kicker ui-text-label-sm">{{ kicker }}</p>
      <h2 class="hero__title ui-text-h1">{{ headline }}</h2>
      <p v-if="summary" class="hero__text ui-text-body-s">{{ summary }}</p>
    </header>

    <section v-if="prizes.length > 0" class="section" aria-labelledby="preview-prizes">
      <h3 id="preview-prizes" class="ui-text-h3">{{ t('cmp.preview.prizes') }}</h3>
      <ul class="tiers">
        <li v-for="(p, i) in prizes" :key="p.id" class="tier" :data-top="i === 0">
          <p class="tier__top ui-text-label-sm">
            <span>{{ i === 0 ? t('cmp.preview.top') : t('cmp.preview.tier', { n: i + 1 }) }}</span>
            <UiBadge tone="info">{{ t(winnersLabelKey(p.winners), { n: p.winners }) }}</UiBadge>
          </p>
          <p class="tier__name ui-text-label">{{ p.name || t('cmp.prize.item', { n: i + 1 }) }}</p>
          <p v-if="p.valueLabel" class="tier__value">{{ p.valueLabel }}</p>
          <p v-if="p.description" class="ui-text-caption ui-text-hint">{{ p.description }}</p>
        </li>
      </ul>
    </section>

    <section class="section" aria-labelledby="preview-form">
      <h3 id="preview-form" class="ui-text-h3">{{ t('cmp.preview.form') }}</h3>
      <ParticipantPreview v-if="hasTemplate" :name="headline" :blocks="blocks" :device="device" />
      <p v-else class="ui-text-caption ui-text-hint">{{ t('cmp.preview.noForm') }}</p>
    </section>
  </article>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  margin-inline: auto;
  padding: var(--ui-space-5);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
  inline-size: 100%;
}
.page[data-device='mobile'] {
  max-inline-size: calc(var(--ui-space-12) * 7);
}
.page p,
.page h2,
.page h3,
.page ul {
  margin: 0;
}
.bar {
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-md);
  color: var(--ui-color-text-secondary);
}
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.kicker {
  align-self: flex-start;
  padding: var(--ui-space-1) var(--ui-space-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-selected-text);
  background: var(--ui-color-selected-bg);
  border-radius: var(--ui-radius-pill);
}
.hero__text {
  color: var(--ui-color-text-secondary);
}
.section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.tiers {
  display: grid;
  gap: var(--ui-space-3);
  padding: 0;
  list-style: none;
  grid-template-columns: minmax(0, 1fr);
}
.page[data-device='desktop'] .tiers {
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
.tier {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-md);
}
.tier[data-top='true'] {
  border-color: var(--ui-color-action-primary);
}
.tier__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
  color: var(--ui-color-text-secondary);
}
.tier__value {
  font-size: var(--ui-font-h1-size);
  line-height: var(--ui-font-h1-line);
  font-weight: 700;
}
</style>
