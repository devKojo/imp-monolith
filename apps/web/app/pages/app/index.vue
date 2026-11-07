<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { classifyAuthError, toApiError, type AuthFailure } from '../../modules/auth/errors';
import { ROLE_LABELS } from '../../modules/auth/validation';

/**
 * Signed-in landing page (client-rendered, no-store: private data never passes the SSR tier).
 * It proves the session works end to end: who you are, which business is active (derived by the
 * server from the session's membership), switching business (rotates the session and CSRF token),
 * and signing out. Campaign tools arrive in later phases.
 */
definePageMeta({ middleware: 'auth' });
useHead({ title: t('app.title') });

const auth = useAuth();
const session = auth.session;
const failure = ref<AuthFailure | null>(null);
const loggingOut = ref(false);
const switching = ref(false);

const active = computed(() =>
  session.value?.memberships.find((m) => m.membershipId === session.value?.active?.membershipId),
);
const selected = ref(session.value?.active?.membershipId ?? '');
watch(
  () => session.value?.active?.membershipId,
  (id) => (selected.value = id ?? ''),
);

const options = computed(
  () =>
    session.value?.memberships.map((m) => ({
      value: m.membershipId,
      label: `${m.businessName} (${ROLE_LABELS[m.role] ?? m.role})`,
    })) ?? [],
);

const nav = [{ label: t('app.nav.overview'), to: '/app', icon: 'globe' as const, current: true }];

async function onSwitch(membershipId: string) {
  if (membershipId === session.value?.active?.membershipId) return;
  failure.value = null;
  switching.value = true;
  try {
    await auth.switchTenant(membershipId);
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'unauthenticated') await navigateTo('/signin');
    failure.value = f;
    selected.value = session.value?.active?.membershipId ?? '';
  } finally {
    switching.value = false;
  }
}

async function logout() {
  loggingOut.value = true;
  try {
    await auth.logout();
  } catch (e) {
    failure.value = classifyAuthError(toApiError(e));
  } finally {
    loggingOut.value = false;
  }
  if (!session.value) await navigateTo('/signin');
}
</script>

<template>
  <UiDashboardShell
    v-if="session"
    :business-name="active?.businessName ?? ''"
    :role-label="active ? (ROLE_LABELS[active.role] ?? active.role) : ''"
    :user-name="session.user.name"
    :nav="nav"
  >
    <h1 class="ui-text-h1">{{ t('app.welcome', { name: session.user.name }) }}</h1>

    <UiSystemState v-if="failure" kind="generic" />

    <div class="cards">
      <UiCard :title="t('app.business')" as="section">
        <p class="ui-text-h3">{{ active?.businessName }}</p>
        <p class="ui-text-body-s ui-text-hint">
          {{ t('app.role') }}: {{ active ? (ROLE_LABELS[active.role] ?? active.role) : '' }}
        </p>
        <UiSelect
          v-if="options.length > 1"
          v-model="selected"
          :label="t('app.switch')"
          :options="options"
          :disabled="switching"
          @update:model-value="onSwitch"
        />
      </UiCard>

      <UiCard title="" as="section">
        <p class="ui-text-body">{{ t('app.soon') }}</p>
        <UiButton
          variant="secondary"
          icon="log-out"
          :loading="loggingOut"
          :loading-label="t('app.loggingOut')"
          @click="logout"
        >
          {{ t('app.logout') }}
        </UiButton>
      </UiCard>
    </div>
  </UiDashboardShell>
  <UiSkeleton v-else variant="card" />
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--ui-space-12) * 6), 1fr));
  gap: var(--ui-space-4);
  margin-block-start: var(--ui-space-4);
}
</style>
