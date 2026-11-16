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
  <UiCarousel
    v-if="current"
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
