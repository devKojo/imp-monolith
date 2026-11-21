<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatInZone } from '@imp/ui/app/utils/datetime';
import { t } from '../../../i18n';
import { BRAND_NAME } from '../../../modules/auth/constants';
import { toApiError } from '../../../modules/auth/errors';
import { siteFooter } from '../../../modules/site/footer';
import ParticipationResult from '../../../modules/participant/components/ParticipationResult.vue';
import { useOpenCampaigns } from '../../../modules/participant/useOpenCampaigns';
import BallotResults from '../../../modules/voting/components/BallotResults.vue';
import { ballotErrorKey } from '../../../modules/voting/errors';
import { isOption, labelOf, rankOf, resultFor } from '../../../modules/voting/logic';
import type { BallotView } from '../../../modules/voting/types';
import { useVoting } from '../../../modules/voting/useVoting';

/**
 * The screen for a poll and for an image vote. A poll shows its question with the answers as cards; an
 * image vote shows its candidates with a picture each. Either way the participant picks one option and
 * confirms, because a vote is final. Once voted (or when the campaign shows standings to everyone) the
 * results appear beside the options.
 */
definePageMeta({ middleware: 'auth', portal: 'participant', ssr: false });

const slug = String(useRoute().params.slug);
const voting = useVoting();
const footer = siteFooter();

const openCampaigns = useOpenCampaigns();
const next = computed(() => openCampaigns.campaigns.value.find((c) => c.slug !== slug) ?? null);
// Confetti only right after casting the vote, not when coming back to a vote that was cast earlier.
const justVoted = ref(false);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const state = ref<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
const view = ref<BallotView | null>(null);
const selected = ref<number | null>(null);
const confirmOpen = ref(false);
const submitting = ref(false);
const problem = ref('');

const isPoll = computed(() => view.value?.kind === 'poll');
const voted = computed(() => view.value?.vote ?? null);
const heading = computed(() => (isPoll.value && view.value?.question) || view.value?.title || '');
useHead({ title: computed(() => view.value?.title || t('ballot.page.title.poll')) });

async function load() {
  state.value = 'loading';
  try {
    view.value = await voting.current(slug);
    state.value = 'ready';
  } catch (e) {
    const err = toApiError(e);
    // A business account cannot vote; the campaign page explains that.
    if (err.code === 'PARTICIPANT_ONLY') return void navigateTo(`/c/${slug}`);
    state.value = err.status === 404 ? 'unavailable' : 'error';
  }
}
onMounted(load);

const pollOptions = computed(() =>
  (view.value?.options ?? []).map((o) => ({ value: String(o.index), label: o.label })),
);
const choose = (index: number) => {
  if (!voted.value) selected.value = index;
  problem.value = '';
};

function review() {
  if (!view.value || !isOption(view.value.options, selected.value)) {
    problem.value = t('ballot.pick');
    return;
  }
  confirmOpen.value = true;
}

async function cast() {
  if (!isOption(view.value?.options ?? [], selected.value)) return;
  submitting.value = true;
  problem.value = '';
  try {
    view.value = await voting.cast(slug, selected.value);
    justVoted.value = view.value?.vote != null;
  } catch (e) {
    const err = toApiError(e);
    problem.value = t(ballotErrorKey(err));
    // Someone else's tab voted first: show what is stored.
    if (err.code === 'ALREADY_VOTED')
      view.value = await voting.current(slug).catch(() => view.value);
  } finally {
    confirmOpen.value = false;
    submitting.value = false;
  }
}

/** What the person sees once they have voted: the same result screen every campaign type ends with. */
const result = computed(() => {
  const v = view.value;
  const mine = v?.vote;
  if (!v || !mine) return null;
  const name = labelOf(v.options, mine.optionIndex);
  const rank = rankOf(v.results, mine.optionIndex);
  const share = v.results ? resultFor(v.results, mine.optionIndex).percent : null;
  const closes = formatInZone(new Date(v.endsAt), zone);
  const cast = formatInZone(new Date(mine.castAt), zone);
  const total = v.results ? v.results.total.toLocaleString() : t('result.vote.tile.hidden');
  return {
    verdict: {
      badge: t('result.vote.badge'),
      title: t('result.vote.title'),
      body: t('result.vote.body', { name }),
    },
    headline: v.results
      ? [
          { label: t('result.vote.share'), value: `${share}%`, suffix: name },
          { label: t('result.vote.total'), value: total },
        ]
      : [{ label: t('result.vote.choice'), value: name }],
    nextBody: t(v.results ? 'result.vote.next.shown' : 'result.vote.next.hidden', { date: closes }),
    tiles: [
      { label: t('result.vote.tile.options'), value: String(v.options.length) },
      {
        label: t('result.vote.tile.rank'),
        value:
          rank === null
            ? t('result.vote.tile.hidden')
            : t('result.vote.tile.rank.value', { n: rank, m: v.options.length }),
      },
      { label: t('result.vote.tile.votes'), value: total },
    ],
    details: [
      {
        label: t('result.vote.details.type'),
        value: t(isPoll.value ? 'type.poll.one' : 'type.vote.one'),
      },
      { label: t('result.vote.choice'), value: name },
      { label: t('result.vote.details.when'), value: cast },
      { label: t('result.vote.details.closes'), value: closes },
    ],
    caption: t('result.vote.cast', { when: cast }),
  };
});

const chooseLabel = computed(() => t(isPoll.value ? 'ballot.choose.poll' : 'ballot.choose.vote'));
const chosenLabel = computed(() => labelOf(view.value?.options ?? [], selected.value));
const votedLabel = computed(() =>
  labelOf(view.value?.options ?? [], voted.value?.optionIndex ?? null),
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
    <UiSkeleton v-if="state === 'loading'" variant="card" />

    <UiEmptyState
      v-else-if="state === 'unavailable'"
      :title="t('ballot.unavailable.title')"
      :description="t('ballot.unavailable.body')"
    >
      <UiButton to="/discover" variant="secondary" size="xs">{{ t('quiz.back') }}</UiButton>
    </UiEmptyState>

    <UiSystemState v-else-if="state === 'error' || !view" kind="generic" @action="load" />

    <div v-else-if="voted && result" class="wrap">
      <ParticipationResult
        :type-label="t(isPoll ? 'type.poll.one' : 'type.vote.one')"
        :title="heading"
        :business-name="view.businessName"
        :caption="result.caption"
        :verdict="result.verdict"
        :headline="result.headline"
        :next-title="t('result.vote.next.title')"
        :next-body="result.nextBody"
        :summary-title="t('result.vote.summary.title')"
        :tiles="result.tiles"
        :details-title="t('result.vote.details.title')"
        :details="result.details"
        :next="next"
        :now="openCampaigns.now.value"
        :celebrate="justVoted"
      >
        <template #actions>
          <UiButton :to="`/c/${slug}`" variant="secondary">{{ t('ballot.back') }}</UiButton>
        </template>
        <template v-if="view.results" #extra>
          <UiCard as="div" class="standings">
            <BallotResults
              :options="view.options"
              :results="view.results"
              :yours="voted.optionIndex"
            />
          </UiCard>
        </template>
      </ParticipationResult>
      <p class="ui-text-caption ui-text-hint final">{{ t('result.vote.details.final') }}</p>
    </div>

    <div v-else class="wrap">
      <header class="head">
        <p class="ui-text-label-sm head__kicker">
          {{ t(isPoll ? 'ballot.page.title.poll' : 'ballot.page.title.vote') }}
        </p>
        <h1 class="ui-text-h1 head__title">{{ heading }}</h1>
        <p v-if="view.summary && !isPoll" class="ui-text-body head__text">{{ view.summary }}</p>
        <p v-else-if="view.helper" class="ui-text-body head__text">{{ view.helper }}</p>
        <p class="ui-text-caption ui-text-hint">
          {{ t('quiz.by', { business: view.businessName }) }}
        </p>
      </header>

      <UiBanner v-if="voted" tone="info" :title="t('ballot.voted.title')" role="status">
        {{ t('ballot.voted.body', { name: votedLabel }) }}
      </UiBanner>
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

      <div class="layout" :data-split="view.results !== null && !voted">
        <section v-if="!voted" class="options" :aria-label="chooseLabel">
          <UiChoiceGroup
            v-if="isPoll"
            :model-value="selected === null ? '' : String(selected)"
            :legend="t('ballot.choose.poll')"
            variant="cards"
            :options="pollOptions"
            @update:model-value="choose(Number($event))"
          />

          <div v-else role="group" :aria-label="t('ballot.choose.vote')" class="grid">
            <article
              v-for="o in view.options"
              :key="o.index"
              class="candidate"
              :data-selected="selected === o.index"
            >
              <img
                v-if="o.imageUrl"
                class="candidate__image"
                :src="o.imageUrl"
                :alt="t('vote.candidate.imageAlt', { name: o.label })"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <div class="candidate__body">
                <h2 class="ui-text-h3">{{ o.label }}</h2>
                <p v-if="o.description" class="ui-text-body-s ui-text-hint">{{ o.description }}</p>
              </div>
              <UiButton
                :variant="selected === o.index ? 'primary' : 'secondary'"
                size="xs"
                block
                :icon="selected === o.index ? 'check-circle' : undefined"
                :aria-pressed="selected === o.index"
                @click="choose(o.index)"
              >
                {{
                  selected === o.index
                    ? t('ballot.selected')
                    : t('ballot.select', { name: o.label })
                }}
              </UiButton>
            </article>
          </div>

          <div class="submit">
            <UiButton
              size="lg"
              icon-trailing="arrow-right"
              :disabled="selected === null"
              @click="review"
            >
              {{ t('ballot.submit') }}
            </UiButton>
            <p class="ui-text-caption ui-text-hint">{{ t('ballot.final') }}</p>
          </div>
        </section>

        <UiCard v-if="view.results" as="div" class="standings">
          <BallotResults
            :options="view.options"
            :results="view.results"
            :yours="voted?.optionIndex ?? null"
          />
        </UiCard>
        <UiBanner v-else-if="!voted" tone="info">{{ t('ballot.results.hidden') }}</UiBanner>
      </div>

      <div v-if="voted" class="actions">
        <UiButton :to="`/c/${slug}`" variant="secondary" size="xs">{{ t('ballot.back') }}</UiButton>
        <UiButton to="/me" size="xs">{{ t('quiz.toDashboard') }}</UiButton>
      </div>
    </div>

    <UiConfirmDialog
      v-model:open="confirmOpen"
      :title="t('ballot.confirm.title')"
      :consequence="t('ballot.confirm.consequence', { name: chosenLabel })"
      :confirm-label="t('ballot.submit')"
      :loading="submitting"
      @confirm="cast"
    />
  </UiPublicShell>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
  inline-size: 100%;
  max-inline-size: calc(var(--ui-space-12) * 24);
  margin-block: var(--ui-space-6);
  margin-inline: auto;
  padding-inline: var(--ui-space-4);
}
.final {
  margin: 0;
  text-align: center;
}
@media (min-width: 768px) {
  .wrap {
    padding-inline: var(--ui-space-8);
  }
}
.head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.head h1,
.head p {
  margin: 0;
}
.head__kicker {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-selected-text);
}
.head__title {
  overflow-wrap: anywhere;
}
.layout {
  display: grid;
  gap: var(--ui-space-5);
  align-items: start;
}
@media (min-width: 900px) {
  .layout[data-split='true'] {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }
}
.options {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  min-inline-size: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(var(--ui-space-12) * 5)), 1fr));
  gap: var(--ui-space-4);
}
.candidate {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.candidate[data-selected='true'] {
  border-color: var(--ui-color-action-primary);
  box-shadow: 0 0 0 2px var(--ui-color-action-primary);
}
.candidate__image {
  inline-size: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--ui-radius-md);
  background: var(--ui-color-selected-bg);
}
.candidate__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.candidate__body h2,
.candidate__body p {
  margin: 0;
  overflow-wrap: anywhere;
}
.submit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
}
.submit p {
  margin: 0;
}
.standings {
  min-inline-size: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
