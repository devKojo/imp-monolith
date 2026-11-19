<script setup lang="ts">
import { t } from '../../i18n';
import ParticipantShell from '../../modules/participant/components/ParticipantShell.vue';

/**
 * Participant rewards (client-rendered, no-store): rewards available to claim, rewards already
 * claimed, and the wallet that claimed points and money go into. There is no rewards data behind
 * this yet (nothing awards or pays out), so every section says so honestly instead of showing
 * made-up figures; the claim action arrives with the rewards API.
 */
definePageMeta({ middleware: 'auth', portal: 'participant' });
useHead({ title: t('rewards.title') });
</script>

<template>
  <ParticipantShell current="rewards">
    <header class="head">
      <h1 class="head__title">{{ t('rewards.title') }}</h1>
      <p class="head__summary ui-text-body-l">{{ t('rewards.summary') }}</p>
    </header>

    <section class="block" aria-labelledby="wallet-title">
      <h2 id="wallet-title" class="ui-text-h2">{{ t('rewards.wallet.title') }}</h2>
      <UiEmptyState
        :title="t('rewards.wallet.empty.title')"
        :description="t('rewards.wallet.empty.body')"
        icon="gift"
        :heading-level="3"
      />
    </section>

    <section class="block" aria-labelledby="available-title">
      <h2 id="available-title" class="ui-text-h2">{{ t('rewards.available.title') }}</h2>
      <UiEmptyState
        :title="t('rewards.available.empty.title')"
        :description="t('rewards.available.empty.body')"
        icon="gift"
        :heading-level="3"
      >
        <UiButton to="/discover">{{ t('me.empty.action') }}</UiButton>
      </UiEmptyState>
    </section>

    <section class="block" aria-labelledby="claimed-title">
      <h2 id="claimed-title" class="ui-text-h2">{{ t('rewards.claimed.title') }}</h2>
      <UiEmptyState
        :title="t('rewards.claimed.empty.title')"
        :description="t('rewards.claimed.empty.body')"
        icon="ticket"
        :heading-level="3"
      />
    </section>
  </ParticipantShell>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-8);
}
.head__title {
  margin: 0;
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: 800;
  letter-spacing: -0.025em;
}
.head__summary {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
</style>
