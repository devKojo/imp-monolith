<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import ParticipantShell from '../../modules/participant/components/ParticipantShell.vue';
import CampaignCarousel from '../../modules/participant/components/CampaignCarousel.vue';
import MyParticipations from '../../modules/participant/components/MyParticipations.vue';
import { useMyParticipations } from '../../modules/participant/useMyParticipations';
import { useOpenCampaigns } from '../../modules/participant/useOpenCampaigns';
import VerifyEmailPrompt from '../../modules/auth/components/VerifyEmailPrompt.vue';

/**
 * Participant hub (client-rendered, no-store). Participants have an account but no business
 * (ADR-P001). Lists the person's own quiz attempts and survey responses; draws and rewards are
 * not shown yet, and the page never shows made-up figures.
 */
definePageMeta({ middleware: 'auth', portal: 'participant' });
useHead({ title: t('me.home.title') });

const auth = useAuth();
const session = auth.session;
const open = useOpenCampaigns();
const mine = useMyParticipations();

const firstName = computed(() => session.value?.user.name.trim().split(/\s+/)[0] ?? '');
</script>

<template>
  <ParticipantShell current="home">
    <VerifyEmailPrompt class="gap-after" />
    <header class="hero">
      <UiBadge shape="pill" tone="info">{{ t('me.eyebrow') }}</UiBadge>
      <h1 class="hero__title">
        {{ t('me.welcome') }}
        <span class="hero__name">{{ firstName }}</span>
      </h1>
      <p class="hero__summary ui-text-body-l">
        {{ t('me.summary') }}
      </p>
    </header>

    <section class="open-campaigns">
      <UiSkeleton v-if="open.pending.value" variant="card" />
      <UiSystemState v-else-if="open.error.value" kind="generic" @action="open.refresh()" />
      <CampaignCarousel v-else :campaigns="open.campaigns.value" :now="open.now.value" />
    </section>

    <UiSkeleton v-if="mine.pending.value" variant="card" />
    <UiSystemState v-else-if="mine.error.value" kind="generic" @action="mine.refresh()" />
    <MyParticipations v-else-if="mine.items.value.length > 0" :items="mine.items.value" />
    <UiEmptyState
      v-else
      :title="t('me.empty.title')"
      :description="t('me.empty.body')"
      icon="ticket"
    >
      <UiButton to="/discover">{{ t('me.empty.action') }}</UiButton>
    </UiEmptyState>
  </ParticipantShell>
</template>

<style scoped>
.gap-after {
  margin-block-end: var(--ui-space-6);
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-8);
}
.hero__title {
  margin: 0;
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  letter-spacing: -0.025em;
}
.hero__name {
  color: var(--ui-color-action-primary);
}
.open-campaigns {
  margin-block-end: var(--ui-space-8);
}
.hero__summary {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
</style>
