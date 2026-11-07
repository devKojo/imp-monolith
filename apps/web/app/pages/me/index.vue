<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../modules/auth/constants';
import VerifyEmailPrompt from '../../modules/auth/components/VerifyEmailPrompt.vue';
import { participantSample as sample } from '../../modules/participant/sample';

/**
 * Participant hub (client-rendered, no-store). Participants have an account but no business
 * (ADR-P001). The figures are labelled samples until the participation API exists.
 */
definePageMeta({ middleware: 'auth', portal: 'participant' });
useHead({ title: t('me.title') });

const auth = useAuth();
const session = auth.session;
const loggingOut = ref(false);

const firstName = computed(() => session.value?.user.name.trim().split(/\s+/)[0] ?? '');
const nav = [
  { label: t('me.nav.rewards'), to: '/me', current: true },
  { label: t('me.nav.discover'), to: '/discover' },
];

async function logout() {
  loggingOut.value = true;
  try {
    await auth.logout();
  } finally {
    loggingOut.value = false;
  }
  await navigateTo(SIGNIN.participant);
}
</script>

<template>
  <UiPortalShell
    v-if="session"
    :brand-name="BRAND_NAME"
    :nav="nav"
    :nav-label="t('me.nav.label')"
    :user-name="session.user.name"
    :user-status="session.user.emailVerified ? t('me.verified') : undefined"
    :sign-out-label="loggingOut ? t('me.loggingOut') : t('me.logout')"
    @sign-out="logout"
  >
    <VerifyEmailPrompt class="gap-after" />
    <UiBanner tone="system" :title="t('me.sample.title')" class="gap-after">
      {{ t('me.sample.body') }}
    </UiBanner>

    <header class="hero">
      <UiBadge shape="pill" tone="info">{{ t('me.eyebrow') }}</UiBadge>
      <h1 class="hero__title">
        {{ t('me.welcome') }}
        <span class="hero__name">{{ firstName }}</span>
      </h1>
      <p class="hero__summary ui-text-body-l">
        {{ t('me.summary', { ready: sample.rewardsReady, draws: sample.draws.length }) }}
      </p>
    </header>

    <section class="stats" :aria-label="t('me.stats.label')">
      <UiStatCard
        label-style="eyebrow"
        :label="t('me.stat.entries')"
        :value="String(sample.activeEntries)"
        :suffix="t('me.stat.entries.suffix')"
        icon="ticket"
      />
      <UiStatCard
        label-style="eyebrow"
        :label="t('me.stat.rewards')"
        :value="sample.rewardsValue"
        :badge="t('me.stat.rewards.ready', { n: sample.rewardsReady })"
        icon="cash"
        icon-tone="success"
      />
      <UiStatCard
        label-style="eyebrow"
        :label="t('me.stat.next')"
        :value="t('me.stat.next.value', { hours: sample.nextDrawHours })"
        icon="timer"
      />
    </section>

    <section class="feature">
      <UiClaimCard
        :eyebrow="t('me.claim.eyebrow')"
        :meta="t('me.claim.expires', { days: sample.claim.expiresInDays })"
        :amount="sample.claim.amount"
        :title="sample.claim.title"
        :description="t('me.claim.body')"
        :note="t('me.claim.note')"
      >
        <template #action>
          <UiButton variant="secondary" icon="zap" disabled>{{ t('me.claim.action') }}</UiButton>
        </template>
      </UiClaimCard>
      <UiInstantWinCard
        :tag="t('me.win.tag')"
        :reference="t('me.win.ref', { ref: sample.instantWin.reference })"
        :title="t('me.win.title')"
        :description="
          t('me.win.body', { odds: sample.instantWin.odds, prize: sample.instantWin.prize })
        "
        :panel-title="t('me.win.panel')"
        :panel-text="t('me.win.panelText')"
      >
        <template #action>
          <UiButton block icon="wand" disabled>{{ t('me.win.action') }}</UiButton>
        </template>
      </UiInstantWinCard>
    </section>

    <section class="draws" aria-labelledby="draws-title">
      <div class="draws__head">
        <div>
          <h2 id="draws-title" class="ui-text-h2">{{ t('me.draws.title') }}</h2>
          <p class="ui-text-body-s ui-text-hint">{{ t('me.draws.subtitle') }}</p>
        </div>
        <p class="ui-text-label-sm ui-text-hint">
          {{ t('me.draws.count', { n: sample.draws.length }) }}
        </p>
      </div>
      <div class="draws__grid">
        <UiDrawCard
          v-for="d in sample.draws"
          :key="d.id"
          :icon="d.icon"
          :title="d.title"
          :subtitle="d.subtitle"
          :when="t('me.draw.in', { n: d.whenDays })"
          :ticket-label="t('me.draw.ticket')"
          :ticket="`#${d.ticket}`"
          :status="t('me.draw.confirmed')"
        />
      </div>
    </section>

    <template #footer>
      <span>© {{ t('me.footer') }}</span>
    </template>
  </UiPortalShell>
  <UiSkeleton v-else variant="card" />
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
.hero__summary {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
  margin-block-end: var(--ui-space-8);
}
.feature {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-6);
  margin-block-end: var(--ui-space-10);
}
.draws__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-4);
}
.draws__head p {
  margin: 0;
}
.draws__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
}
@media (min-width: 768px) {
  .stats,
  .draws__grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .draws__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .feature {
    grid-template-columns: 1.45fr 1fr;
  }
}
</style>
