<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IconName } from '@imp/ui/app/icons';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t, type AppTextKey } from '../../../i18n';
import { timeLeftText } from '../../discovery/logic';
import type { CampaignType, DiscoveryCampaign } from '../../discovery/types';

/**
 * "Available campaigns" on the participant hub: one open campaign at a time as a feature card, and
 * a quick-switch list of the others. Everything shown comes from the public listing; entering goes
 * to the campaign page (/c/:slug), where the participant takes part.
 */
const props = defineProps<{ campaigns: DiscoveryCampaign[]; now: number }>();

const typeIcons: Record<CampaignType, IconName> = {
  quiz: 'clipboard-list',
  poll: 'bar-chart',
  survey: 'clipboard-list',
  vote: 'check-circle',
  giveaway: 'gift',
};
const typeOne: Record<CampaignType, AppTextKey> = {
  quiz: 'type.quiz.one',
  poll: 'type.poll.one',
  survey: 'type.survey.one',
  vote: 'type.vote.one',
  giveaway: 'type.giveaway.one',
};

const index = ref(0);
watch(
  () => props.campaigns.length,
  (n) => {
    if (index.value >= n) index.value = 0;
  },
);

const items = computed(() =>
  props.campaigns.map((c) => ({
    ...c,
    typeLabel: t(typeOne[c.type]),
    typeIcon: typeIcons[c.type],
    timeLeft: timeLeftText(c.endsAt, props.now),
    endsAtLabel: formatInZone(new Date(c.endsAt), c.timeZone),
  })),
);
const current = computed(() => items.value[Math.min(index.value, items.value.length - 1)]);
</script>

<template>
  <!-- Exactly two open campaigns: no carousel, the first is the feature card and the second a card of the
       same size as the instant-win card, side by side. -->
  <section v-if="items.length === 2" class="pair" aria-labelledby="pair-title">
    <div class="pair__head">
      <h2 id="pair-title" class="ui-text-h2">{{ t('me.carousel.title') }}</h2>
      <UiBadge tone="info" shape="pill">{{ t('me.carousel.count', { n: 2 }) }}</UiBadge>
    </div>
    <p class="ui-text-body-s ui-text-hint pair__sub">{{ t('me.carousel.subtitle') }}</p>
    <div class="pair__grid">
      <UiClaimCard
        :eyebrow="items[0]!.typeLabel"
        :meta="items[0]!.timeLeft"
        :amount="items[0]!.prize?.value"
        :title="items[0]!.title"
        :description="items[0]!.summary"
        :note="t('me.carousel.by', { business: items[0]!.businessName })"
      >
        <template #action>
          <UiButton :to="`/c/${items[0]!.slug}`" icon-trailing="arrow-right">
            {{ t('me.carousel.enter') }}
          </UiButton>
        </template>
      </UiClaimCard>
      <UiInstantWinCard
        :tag="items[1]!.typeLabel"
        :reference="items[1]!.timeLeft"
        :title="items[1]!.title"
        :description="items[1]!.summary"
        :panel-title="items[1]!.prize?.value ?? t('me.pair.open')"
        :panel-text="t('me.carousel.by', { business: items[1]!.businessName })"
      >
        <template #action>
          <UiButton block :to="`/c/${items[1]!.slug}`" icon-trailing="arrow-right">
            {{ t('me.carousel.enter') }}
          </UiButton>
        </template>
      </UiInstantWinCard>
    </div>
  </section>

  <UiCarousel
    v-else-if="current"
    v-model="index"
    :title="t('me.carousel.title')"
    :subtitle="t('me.carousel.subtitle')"
    :badge="t('me.carousel.count', { n: items.length })"
    :count="items.length"
  >
    <div class="slide">
      <UiClaimCard
        :eyebrow="current.typeLabel"
        :meta="current.timeLeft"
        :amount="current.prize?.value"
        :title="current.title"
        :description="current.summary"
        :note="t('me.carousel.by', { business: current.businessName })"
      >
        <template #action>
          <UiButton :to="`/c/${current.slug}`" icon-trailing="arrow-right">
            {{ t('me.carousel.enter') }}
          </UiButton>
        </template>
      </UiClaimCard>

      <nav v-if="items.length > 1" class="queue" :aria-label="t('me.carousel.queue')">
        <p class="queue__title ui-text-label-sm ui-text-hint">{{ t('me.carousel.queue') }}</p>
        <ul class="queue__list">
          <li v-for="(c, i) in items" :key="c.id">
            <UiButton
              block
              :variant="i === index ? 'primary' : 'secondary'"
              :icon="c.typeIcon"
              :aria-current="i === index ? 'true' : undefined"
              @click="index = i"
            >
              {{ c.title }} · {{ c.timeLeft }}
            </UiButton>
          </li>
        </ul>
      </nav>
    </div>
  </UiCarousel>
</template>

<style scoped>
.pair__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}
.pair__head h2,
.pair__sub {
  margin: 0;
}
.pair__sub {
  margin-block-end: var(--ui-space-4);
}
.pair__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-6);
}
@media (min-width: 1024px) {
  .pair__grid {
    grid-template-columns: 1.45fr 1fr;
  }
}
.slide {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-5);
}
.queue {
  padding: var(--ui-space-5);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-xl);
  background: var(--ui-color-surface);
}
.queue__title {
  margin: 0 0 var(--ui-space-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.queue__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
@media (min-width: 1024px) {
  .slide {
    grid-template-columns: 1.6fr 1fr;
    align-items: start;
  }
}
</style>
