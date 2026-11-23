<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { useUnavailableExit } from '../../../modules/auth/composables/useHomeLink';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { toApiError } from '../../../modules/auth/errors';
import { siteFooter } from '../../../modules/site/footer';
import { timeLeftText } from '../../../modules/discovery/logic';
import ParticipationResult from '../../../modules/participant/components/ParticipationResult.vue';
import { useOpenCampaigns } from '../../../modules/participant/useOpenCampaigns';
import type { GiveawayView } from '../../../modules/giveaway/types';
import { useGiveaway } from '../../../modules/giveaway/useGiveaway';

/**
 * The participant's ticket for a giveaway they have entered. Entering happens on the campaign page; a person
 * who has not entered is sent back there. Rendered in the browser: it reads the signed-in session.
 */
const exit = useUnavailableExit();
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });

const slug = String(useRoute().params.slug);
const giveaway = useGiveaway();
const footer = siteFooter();

const openCampaigns = useOpenCampaigns();
const next = computed(() => openCampaigns.campaigns.value.find((c) => c.slug !== slug) ?? null);
// Confetti only for someone who has just entered (the campaign page adds ?welcome=1), not on a return visit.
const celebrate = useRoute().query.welcome === '1';

const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const view = ref<GiveawayView | null>(null);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

useHead({ title: computed(() => view.value?.title || t('giveaway.page.title')) });

async function load() {
  state.value = 'loading';
  try {
    const found = await giveaway.current(slug);
    // Not entered yet: the way in is the campaign page.
    if (!found.entry) return void navigateTo(`/c/${slug}`);
    view.value = found;
    state.value = 'ready';
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'PARTICIPANT_ONLY') return void navigateTo(`/c/${slug}`);
    state.value = err.status === 404 ? 'unavailable' : 'error';
  }
}
onMounted(load);

const entered = computed(() =>
  view.value?.entry ? formatInZone(new Date(view.value.entry.enteredAt), zone) : '',
);
const closes = computed(() => (view.value ? formatInZone(new Date(view.value.endsAt), zone) : ''));

const result = computed(() => {
  const v = view.value;
  if (!v?.entry) return null;
  const n = Math.max(1, v.entryCount);
  return {
    verdict: {
      badge: t('result.giveaway.badge'),
      title: t('result.giveaway.title'),
      body: t('result.giveaway.body', { title: v.title }),
    },
    headline: [
      {
        label: t('result.giveaway.ticket'),
        value: t('giveaway.ticket.number', { n: v.entry.ticketNumber }),
      },
      { label: t('result.giveaway.entries'), value: v.entryCount.toLocaleString() },
    ],
    tiles: [
      {
        label: t('result.giveaway.ticket'),
        value: t('giveaway.ticket.number', { n: v.entry.ticketNumber }),
      },
      {
        label: t('result.giveaway.tile.odds'),
        value: t('result.giveaway.tile.odds.value', { n: n.toLocaleString() }),
      },
      {
        label: t('result.giveaway.tile.left'),
        value: timeLeftText(v.endsAt, openCampaigns.now.value),
      },
    ],
    details: [
      { label: t('result.giveaway.details.entered'), value: entered.value },
      { label: t('result.giveaway.details.closes'), value: closes.value },
      { label: t('result.giveaway.details.ticket'), value: String(v.entry.ticketNumber) },
    ],
  };
});
</script>

<template>
  <UiPublicShell
    :brand-name="BRAND_NAME"
    wide
    :footer-tagline="footer.tagline"
    :footer-columns="footer.columns"
    :copyright="footer.copyright"
  >
    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'unavailable'"
      :title="t('giveaway.unavailable.title')"
      :description="t('giveaway.unavailable.body')"
    >
      <UiButton :to="exit.to" variant="secondary" size="xs">{{ exit.label }}</UiButton>
    </UiEmptyState>

    <UiSystemState
      v-else-if="state === 'error' || !view || !view.entry"
      kind="generic"
      @action="load"
    />

    <div v-else-if="result" class="wrap">
      <ParticipationResult
        :type-label="t('type.giveaway.one')"
        :title="view.title"
        :business-name="view.businessName"
        :caption="t('giveaway.entered', { date: entered })"
        :verdict="result.verdict"
        :headline="result.headline"
        :next-title="t('result.giveaway.next.title')"
        :next-body="t('result.giveaway.next.body')"
        :summary-title="t('result.giveaway.summary.title')"
        :tiles="result.tiles"
        :details-title="t('result.giveaway.details.title')"
        :details="result.details"
        :next="next"
        :now="openCampaigns.now.value"
        :celebrate="celebrate"
      >
        <template #actions>
          <UiButton to="/me/rewards" icon="arrow-right">{{
            t('result.giveaway.rewards')
          }}</UiButton>
          <UiButton :to="`/c/${slug}`" variant="secondary">{{ t('ballot.back') }}</UiButton>
        </template>
      </ParticipationResult>
    </div>
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 24);
  margin-block: var(--ui-space-8);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
</style>
