<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import type { IconName } from '@imp/ui/app/icons';
import { t, type AppTextKey } from '../i18n';
import { useDiscovery } from '../modules/discovery/composables/useDiscovery';
import { BRAND_NAME } from '../modules/auth/constants';
import { siteFooter } from '../modules/site/footer';
import { PAGE_SIZE, countText, nextVisible, timeLeftText } from '../modules/discovery/logic';
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

// Paging: reveal PAGE_SIZE at a time. A sentinel below the grid loads the next page as it scrolls
// into view; the visible button does the same for keyboard users and when scripts are blocked.
const visible = ref(PAGE_SIZE);
watch(
  () => [query.value.q, query.value.type],
  () => (visible.value = PAGE_SIZE),
);
const shown = computed(() => cards.value.slice(0, visible.value));
const hasMore = computed(() => visible.value < cards.value.length);
const showMore = () => (visible.value = nextVisible(visible.value, cards.value.length));
const shownText = computed(() =>
  t('discover.shown', { shown: shown.value.length, total: cards.value.length }),
);

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && hasMore.value) showMore();
    },
    { rootMargin: '240px' },
  );
  watch(
    sentinel,
    (el, old) => {
      if (old) observer?.unobserve(old);
      if (el) observer?.observe(el);
    },
    { immediate: true },
  );
});
onBeforeUnmount(() => observer?.disconnect());

const footer = siteFooter();

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
  <UiPublicShell
    :brand-name="BRAND_NAME"
    wide
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <template #nav>
      <UiLink to="/discover" aria-current="page">{{ t('nav.discover') }}</UiLink>
      <UiLink to="/business">{{ t('nav.forBusinesses') }}</UiLink>
    </template>
    <template #actions>
      <UiButton to="/signin" variant="secondary">{{ t('nav.signin') }}</UiButton>
      <UiButton to="/signup">{{ t('nav.signup') }}</UiButton>
    </template>

    <section class="hero" aria-labelledby="discover-title">
      <div class="hero__inner">
        <p v-if="livePill" class="pill ui-text-label-sm">
          <span class="pill__dot" aria-hidden="true" />{{ livePill }}
        </p>
        <h1 id="discover-title" class="hero__title ui-text-h1">{{ t('discover.title') }}</h1>
        <p class="hero__lead ui-text-caption">{{ t('discover.subtitle') }}</p>
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
      <section class="results" aria-labelledby="results-title">
        <div class="results__head">
          <h2 id="results-title" class="ui-text-h2">
            {{ t('discover.results.title') }}
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
          <li v-for="c in shown" :key="c.id">
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

        <div v-if="!error && cards.length > 0" class="more">
          <p class="more__count ui-text-caption ui-text-hint">{{ shownText }}</p>
          <template v-if="hasMore">
            <div ref="sentinel" class="more__sentinel" aria-hidden="true" />
            <UiButton variant="secondary" size="sm" @click="showMore">
              {{ t('discover.more') }}
            </UiButton>
          </template>
        </div>
      </section>
    </div>
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

/* Hero: flat, no gradient or glow. */
.hero {
  position: relative;
  overflow: hidden;
}
.hero__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-8) var(--ui-space-4) var(--ui-space-6);
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
}
.pill__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  background: currentcolor;
  border-radius: var(--ui-radius-pill);
}
.hero__title {
  max-inline-size: calc(var(--ui-space-12) * 15);
  margin: 0;
  font-weight: 600;
}
.hero__lead {
  max-inline-size: calc(var(--ui-space-12) * 11);
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.hero__search {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 12);
  margin-block-start: var(--ui-space-2);
  text-align: start;
}
.hero__chips {
  justify-content: center;
  max-inline-size: calc(var(--ui-space-12) * 16);
  /* Smaller chips than the page default. */
  --ui-control-target: var(--ui-space-8);
}

.results {
  padding-block: var(--ui-space-6) var(--ui-space-10);
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
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-4);
  margin: var(--ui-space-5) 0 0;
  padding: 0;
  list-style: none;
}
.grid > li {
  min-inline-size: 0;
}

.more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3);
  margin-block-start: var(--ui-space-6);
}
.more__count {
  margin: 0;
}
.more__sentinel {
  block-size: 1px;
  inline-size: 100%;
}
</style>
