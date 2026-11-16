<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../modules/auth/constants';
import VerifyEmailPrompt from '../../modules/auth/components/VerifyEmailPrompt.vue';

/**
 * Participant hub (client-rendered, no-store). Participants have an account but no business
 * (ADR-P001). Only the account is real so far; entries, draws and rewards appear once the
 * participation API exists, until then the page says so instead of showing made-up figures.
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

    <UiEmptyState :title="t('me.empty.title')" :description="t('me.empty.body')" icon="ticket">
      <UiButton to="/discover">{{ t('me.empty.action') }}</UiButton>
    </UiEmptyState>

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
</style>
