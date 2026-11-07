<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import type { IconName } from '@imp/ui/app/icons';
import { t, type AppTextKey } from '../i18n';
import { useDiscovery } from '../modules/discovery/composables/useDiscovery';
import { BRAND_NAME } from '../modules/auth/constants';
import { countText, timeLeftText } from '../modules/discovery/logic';
import { isCampaignType, type CampaignType } from '../modules/discovery/types';

/**
 * Public campaign discovery. Server-rendered and edge-cacheable: no cookies and no per-user data
 * (R-WEB-05), so the signed-in state is deliberately not shown here. Search text and type filter
 * live in the URL. Entering a campaign goes to its page (/c/:slug); participants never sign in to
 * enter, they verify per campaign.
 */
useHead({ title: t('discover.title') });

const discovery = useDiscovery();
const { query, campaigns, pending, error } = discovery;

const text = ref(query.value.q);
watch(
  () => query.value.q,
  (q) => (text.value = q),
);

const type = computed({
  get: () => query.value.type as string,
  set: (v: string) => discovery.setQuery({ type: isCampaignType(v) ? v : 'all' }),
});

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

const typeOptions = [
  { value: 'all', label: t('type.all') },
  { value: 'quiz', label: t('type.quiz'), icon: typeIcons.quiz },
  { value: 'poll', label: t('type.poll'), icon: typeIcons.poll },
  { value: 'survey', label: t('type.survey'), icon: typeIcons.survey },
  { value: 'vote', label: t('type.vote'), icon: typeIcons.vote },
  { value: 'giveaway', label: t('type.giveaway'), icon: typeIcons.giveaway },
];

const cards = computed(() =>
  campaigns.value.map((c) => ({
    ...c,
    typeLabel: t(typeOne[c.type]),
    typeIcon: typeIcons[c.type],
    timeLeft: timeLeftText(c.endsAt, discovery.now.value),
    endsAtLabel: formatInZone(new Date(c.endsAt), c.timeZone),
  })),
);

const filtered = computed(() => query.value.q.trim() !== '' || query.value.type !== 'all');
const resultCount = computed(() => (pending.value ? '' : countText(campaigns.value.length)));
</script>

<template>
  <UiPublicShell :brand-name="BRAND_NAME" wide>
    <template #nav>
      <UiLink to="/discover" aria-current="page">{{ t('nav.discover') }}</UiLink>
      <UiLink to="/business/register">{{ t('nav.forBusinesses') }}</UiLink>
    </template>
    <template #actions>
      <UiButton to="/signin" variant="secondary">{{ t('nav.signin') }}</UiButton>
      <UiButton to="/signup">{{ t('nav.signup') }}</UiButton>
    </template>

    <section class="hero" aria-labelledby="discover-title">
      <h1 id="discover-title" class="ui-text-display">{{ t('discover.title') }}</h1>
      <p class="ui-text-body-l hint">{{ t('discover.subtitle') }}</p>
      <div class="controls">
        <UiSearchField
          v-model="text"
          :label="t('discover.search')"
          @search="discovery.setQuery({ q: $event })"
        />
        <UiFilterChips v-model="type" :label="t('discover.type')" :options="typeOptions" />
      </div>
    </section>

    <UiBanner v-if="discovery.isSample" tone="system" :title="t('discover.sample.title')">
      {{ t('discover.sample.body') }}
    </UiBanner>

    <section class="results" aria-labelledby="results-title">
      <h2 id="results-title" class="ui-text-h2">
        {{ t('nav.discover') }}
        <span class="count ui-text-body-s ui-text-hint">{{ resultCount }}</span>
      </h2>
      <UiLiveRegion :message="resultCount" />

      <UiSystemState v-if="error" kind="generic" @action="discovery.refresh()" />

      <ul v-else-if="pending && cards.length === 0" class="grid" aria-hidden="true">
        <li v-for="n in 3" :key="n"><UiSkeleton variant="card" /></li>
      </ul>

      <ul v-else-if="cards.length > 0" class="grid">
        <li v-for="c in cards" :key="c.id">
          <UiCampaignCard
            :title="c.title"
            :summary="c.summary"
            :business-name="c.businessName"
            :type-label="c.typeLabel"
            :type-icon="c.typeIcon"
            :to="`/c/${c.slug}`"
            :time-left="c.timeLeft"
            :ends-at-iso="c.endsAt"
            :ends-at-label="c.endsAtLabel"
            :prize-label="c.prize ? (c.prize.label ?? t('prize.label')) : undefined"
            :prize-value="c.prize?.value"
            :image-src="c.imageUrl"
            :image-alt="c.imageAlt"
          />
        </li>
      </ul>

      <UiEmptyState
        v-else-if="filtered"
        icon="search"
        :title="t('discover.empty.title')"
        :description="t('discover.empty.body')"
        :heading-level="3"
      >
        <UiButton variant="secondary" @click="discovery.clear()">
          {{ t('discover.empty.clear') }}
        </UiButton>
      </UiEmptyState>
      <UiEmptyState
        v-else
        icon="box"
        :title="t('discover.none.title')"
        :description="t('discover.none.body')"
        :heading-level="3"
      />
    </section>

    <section class="how" aria-labelledby="how-title">
      <h2 id="how-title" class="ui-text-h2">{{ t('discover.how.title') }}</h2>
      <div class="tiles">
        <UiFeatureTile
          icon="shield-check"
          :title="t('discover.how.verified.title')"
          :description="t('discover.how.verified.body')"
        />
        <UiFeatureTile
          icon="trophy"
          :title="t('discover.how.draws.title')"
          :description="t('discover.how.draws.body')"
        />
        <UiFeatureTile
          icon="lock"
          :title="t('discover.how.privacy.title')"
          :description="t('discover.how.privacy.body')"
        />
      </div>
    </section>
  </UiPublicShell>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3);
  padding-block: var(--ui-space-8) var(--ui-space-6);
  text-align: center;
}
.hero h1 {
  margin: 0;
}
.hint {
  max-inline-size: var(--ui-layout-reading-column);
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.controls {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 14);
  margin-block-start: var(--ui-space-3);
  text-align: start;
}
.results,
.how {
  margin-block: var(--ui-space-8);
}
.count {
  margin-inline-start: var(--ui-space-2);
  font-weight: 400;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 6), 1fr));
  gap: var(--ui-space-5);
  margin: var(--ui-space-4) 0 0;
  padding: 0;
  list-style: none;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-4);
  margin-block-start: var(--ui-space-4);
}
</style>
