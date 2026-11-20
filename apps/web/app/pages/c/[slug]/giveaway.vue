<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { toApiError } from '../../../modules/auth/errors';
import { siteFooter } from '../../../modules/site/footer';
import type { GiveawayView } from '../../../modules/giveaway/types';
import { useGiveaway } from '../../../modules/giveaway/useGiveaway';

/**
 * The participant's ticket for a giveaway they have entered. Entering happens on the campaign page; a person
 * who has not entered is sent back there. Rendered in the browser: it reads the signed-in session.
 */
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });

const slug = String(useRoute().params.slug);
const giveaway = useGiveaway();
const footer = siteFooter();

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
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
    </UiEmptyState>

    <UiSystemState
      v-else-if="state === 'error' || !view || !view.entry"
      kind="generic"
      @action="load"
    />

    <div v-else class="wrap">
      <UiCard as="section" aria-labelledby="entered-title" class="done">
        <UiIcon name="check-circle" :size="40" />
        <h1 id="entered-title" class="ui-text-h2">{{ t('giveaway.done.title') }}</h1>
        <p class="ui-text-body">{{ t('giveaway.done.body', { title: view.title }) }}</p>

        <div class="ticket" role="group" :aria-label="t('giveaway.ticket.label')">
          <p class="ui-text-label-sm ticket__label">{{ t('giveaway.ticket.label') }}</p>
          <p class="ticket__number ui-text-display">
            {{ t('giveaway.ticket.number', { n: view.entry.ticketNumber }) }}
          </p>
          <p class="ui-text-caption ui-text-hint">{{ t('giveaway.entered', { date: entered }) }}</p>
        </div>

        <ul class="facts">
          <li class="ui-text-body-s">
            {{ t('giveaway.entries', { n: view.entryCount.toLocaleString() }) }}
          </li>
          <li class="ui-text-body-s">{{ t('giveaway.closes', { date: closes }) }}</li>
        </ul>

        <UiBanner tone="info" :title="t('giveaway.notice.title')">{{
          t('giveaway.notice.body')
        }}</UiBanner>

        <div class="actions">
          <UiButton :to="`/c/${slug}`" variant="secondary" size="xs">{{
            t('ballot.back')
          }}</UiButton>
          <UiButton to="/me" size="xs">{{ t('quiz.toDashboard') }}</UiButton>
        </div>
      </UiCard>
    </div>
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 12);
  margin-block: var(--ui-space-8);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
.done {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  align-items: flex-start;
}
.done h1,
.done p {
  margin: 0;
}
.ticket {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  inline-size: 100%;
  padding: var(--ui-space-4);
  background: var(--ui-color-selected-bg);
  border: 1px dashed var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.ticket__label {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-text-secondary);
}
.ticket__number {
  font-variant-numeric: tabular-nums;
}
.facts {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ui-color-text-secondary);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
