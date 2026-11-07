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
const livePill = computed(() =>
  pending.value || campaigns.value.length === 0
    ? ''
    : t(campaigns.value.length === 1 ? 'discover.live.one' : 'discover.live.other', {
        n: campaigns.value.length,
      }),
);
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
      <div class="hero__glow" aria-hidden="true" />
      <div class="hero__inner">
        <p v-if="livePill" class="pill ui-text-label-sm">
          <span class="pill__dot" aria-hidden="true" />{{ livePill }}
        </p>
        <h1 id="discover-title" class="hero__title ui-text-display">{{ t('discover.title') }}</h1>
        <p class="hero__lead ui-text-body-l">{{ t('discover.subtitle') }}</p>
        <div class="hero__search">
          <UiSearchField
            v-model="text"
            :label="t('discover.search')"
            @search="discovery.setQuery({ q: $event })"
          />
        </div>
        <UiFilterChips
          v-model="type"
          class="hero__chips"
          :label="t('discover.type')"
          :options="typeOptions"
        />
      </div>
    </section>

    <div class="wrap">
      <UiBanner v-if="discovery.isSample" tone="system" :title="t('discover.sample.title')">
        {{ t('discover.sample.body') }}
      </UiBanner>

      <section class="results" aria-labelledby="results-title">
        <div class="results__head">
          <h2 id="results-title" class="ui-text-h2">
            {{ t('discover.results.title') }}
            <UiBadge tone="info">{{ t('discover.results.badge') }}</UiBadge>
          </h2>
          <p class="results__trust ui-text-label-sm">
            <UiIcon name="shield-check" :size="16" />{{ t('discover.results.trust') }}
          </p>
        </div>
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
    </div>

    <section class="how" aria-labelledby="how-title">
      <div class="wrap">
        <h2 id="how-title" class="how__title ui-text-label-sm">{{ t('discover.how.title') }}</h2>
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
      </div>
    </section>
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  inline-size: 100%;
  max-inline-size: var(--ui-layout-content-max);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
@media (min-width: 768px) {
  .wrap {
    padding-inline: var(--ui-space-8);
  }
}

/* Hero: soft vertical wash with a blurred brand glow behind the headline. */
.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    to bottom,
    var(--ui-color-surface-subtle),
    var(--ui-color-surface-page) 85%
  );
}
.hero__glow {
  position: absolute;
  inset-block-start: calc(var(--ui-space-12) * -2);
  inset-inline-start: 50%;
  inline-size: calc(var(--ui-space-12) * 15);
  block-size: calc(var(--ui-space-12) * 7);
  background: var(--ui-color-action-primary);
  border-radius: var(--ui-radius-pill);
  opacity: 0.08;
  filter: blur(80px);
  transform: translateX(-50%);
  pointer-events: none;
}
.hero__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-4);
  padding: var(--ui-space-10) var(--ui-space-4) var(--ui-space-8);
  text-align: center;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin: 0;
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-pill);
  box-shadow: var(--ui-elevation-1);
}
.pill__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  background: currentcolor;
  border-radius: var(--ui-radius-pill);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pill__dot {
    animation: none;
  }
}
.hero__title {
  max-inline-size: calc(var(--ui-space-12) * 15);
  margin: 0;
}
.hero__lead {
  max-inline-size: calc(var(--ui-space-12) * 11);
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.hero__search {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 14);
  margin-block-start: var(--ui-space-3);
  text-align: start;
}
.hero__chips {
  justify-content: center;
  max-inline-size: calc(var(--ui-space-12) * 16);
}

.results {
  padding-block: var(--ui-space-8);
}
.results__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2) var(--ui-space-4);
}
.results__head h2 {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin: 0;
}
.results__trust {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.results__trust :deep(svg) {
  color: var(--ui-color-action-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 6), 1fr));
  gap: var(--ui-space-6);
  margin: var(--ui-space-6) 0 0;
  padding: 0;
  list-style: none;
}
.grid > li {
  min-inline-size: 0;
}

.how {
  padding-block: var(--ui-space-10);
  background: var(--ui-color-surface-subtle);
  border-block-start: 1px solid var(--ui-color-border);
}
.how__title {
  margin: 0 0 var(--ui-space-4);
  color: var(--ui-color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-6);
}
</style>
