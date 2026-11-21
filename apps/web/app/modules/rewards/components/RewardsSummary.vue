<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import { awardAmount, section } from '../logic';
import { useMyRewards } from '../useMyRewards';

/**
 * What a participant has won, at a glance, on their home page: the rewards ready to claim (with the way to
 * claim them) and the points they hold. It never hides a failure behind an empty state: if the rewards cannot
 * be loaded it says so and offers a retry. Shows nothing while there is nothing won and nothing held.
 */
const rewards = useMyRewards();
const awards = computed(() => rewards.awards.data.value.items);
const ready = computed(() => awards.value.filter((a) => section(a) === 'available'));
const checking = computed(
  () => awards.value.filter((a) => a.status === 'PENDING_REVIEW' || a.status === 'HELD').length,
);
const points = computed(() => rewards.wallet.data.value.reduce((n, w) => n + w.points, 0));
const names = computed(() =>
  ready.value
    .slice(0, 3)
    .map((a) => a.prizeName ?? awardAmount(a) ?? a.campaign.title)
    .join(', '),
);
const failed = computed(() => !!rewards.awards.error.value);
const show = computed(
  () => failed.value || ready.value.length > 0 || checking.value > 0 || points.value > 0,
);
</script>

<template>
  <section v-if="show" class="rewards" aria-labelledby="rewards-summary-title">
    <UiBanner v-if="failed" tone="warning" role="status">
      {{ t('rewards.summary.failed') }}
      <UiButton variant="tertiary" size="xs" @click="rewards.refresh()">{{
        t('rewards.summary.retry')
      }}</UiButton>
    </UiBanner>
    <UiCard v-else as="div" class="rewards__card">
      <div class="rewards__text">
        <h2 id="rewards-summary-title" class="ui-text-h3">
          {{
            ready.length > 0
              ? ready.length === 1
                ? t('rewards.summary.ready.one')
                : t('rewards.summary.ready', { n: ready.length })
              : t('rewards.summary.title')
          }}
        </h2>
        <p v-if="ready.length > 0" class="ui-text-body-s">{{ names }}</p>
        <p class="ui-text-caption ui-text-hint">
          <template v-if="points > 0">{{
            t('rewards.wallet.points', { points: points.toLocaleString('en') })
          }}</template>
          <template v-if="points > 0 && checking > 0"> · </template>
          <template v-if="checking > 0">{{
            checking === 1
              ? t('rewards.summary.checking.one')
              : t('rewards.summary.checking', { n: checking })
          }}</template>
        </p>
      </div>
      <UiButton
        to="/me/rewards"
        :variant="ready.length > 0 ? 'primary' : 'secondary'"
        icon-trailing="arrow-right"
      >
        {{ ready.length > 0 ? t('rewards.summary.claim') : t('rewards.summary.open') }}
      </UiButton>
    </UiCard>
  </section>
</template>

<style scoped>
.rewards {
  margin-block-end: var(--ui-space-8);
}
.rewards__card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}
.rewards__text {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  min-inline-size: 0;
}
.rewards__text h2,
.rewards__text p {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
