<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../../i18n';
import { questionsOf } from '../logic';
import type { CampaignResults, Results } from '../types';
import { useCampaignResults } from '../useVoting';
import BallotResults from './BallotResults.vue';

/**
 * How a launched poll or image vote stands, for the business that runs it: counts and shares per option,
 * never who voted. Loaded in the browser when the page opens; a failed load is said, not hidden.
 */
const props = defineProps<{ campaignId: string }>();
const api = useCampaignResults();

const state = ref<'loading' | 'ready' | 'error'>('loading');
const data = ref<CampaignResults | null>(null);

async function load() {
  state.value = 'loading';
  try {
    data.value = await api.results(props.campaignId);
    state.value = 'ready';
  } catch {
    state.value = 'error';
  }
}
onMounted(load);

const results = computed<Results | null>(() =>
  data.value
    ? {
        total: data.value.total,
        options: data.value.options.map(({ index, votes, percent }) => ({ index, votes, percent })),
      }
    : null,
);
/** One block per question; a ballot with a single question shows it under the panel's own title. */
const blocks = computed(() =>
  (data.value ? questionsOf(data.value) : []).map((q, _i, all) => ({
    id: q.id,
    heading: all.length > 1 ? q.question : '',
    options: q.options,
    results: {
      total: q.total,
      options: q.options.map(({ index, votes, percent }) => ({ index, votes, percent })),
    } satisfies Results,
  })),
);
</script>

<template>
  <UiCard as="section" aria-labelledby="ballot-business-title" class="panel">
    <div class="panel__head">
      <h2 id="ballot-business-title" class="ui-text-h3">{{ t('ballot.business.title') }}</h2>
      <p class="ui-text-caption ui-text-hint">{{ t('ballot.business.body') }}</p>
    </div>
    <UiSkeleton v-if="state === 'loading'" variant="card" />
    <UiBanner v-else-if="state === 'error' || !data || !results" tone="error" role="alert">
      {{ t('ballot.business.failed') }}
    </UiBanner>
    <p v-else-if="results.total === 0" class="ui-text-body-s ui-text-hint">
      {{ t('ballot.business.empty') }}
    </p>
    <template v-else>
      <BallotResults
        v-for="b in blocks"
        :key="b.id"
        :options="b.options"
        :results="b.results"
        :heading="b.heading"
      />
    </template>
  </UiCard>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.panel__head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.panel__head h2,
.panel__head p {
  margin: 0;
}
</style>
