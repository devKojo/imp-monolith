<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import { awardAmount, rewardPrompt } from '../logic';
import type { MyAward } from '../types';

/**
 * What a person sees on the result screen when they passed and won a tier: which place, what it is worth, and
 * one action. A reward ready to claim goes straight to claiming it (My rewards opens the claim); one under a
 * routine check, or already claimed, goes to where it stands. The business still reviews and pays money, so
 * the words say "claim", never "paid".
 */
const props = defineProps<{ reward: MyAward; headingId: string }>();

const prompt = computed(() => rewardPrompt(props.reward));
const amount = computed(() => awardAmount(props.reward) ?? props.reward.prizeName ?? '');
const target = computed(() =>
  prompt.value === 'claim' ? `/me/rewards?claim=${props.reward.id}` : '/me/rewards',
);
</script>

<template>
  <h2 :id="headingId" class="ui-text-h3">
    {{
      reward.rank
        ? t('result.reward.title.ranked', { n: reward.rank })
        : t('result.reward.title.plain')
    }}
  </h2>
  <p class="ui-text-body">
    {{
      t(`result.reward.body.${prompt}` as const, {
        amount,
        business: reward.businessName,
      })
    }}
  </p>
  <UiButton :to="target" icon="arrow-right">
    {{ t(prompt === 'claim' ? 'result.reward.cta.claim' : 'result.reward.cta.view') }}
  </UiButton>
</template>
