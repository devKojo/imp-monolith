<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../../i18n';
import { useAuth } from '../../auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../auth/constants';
import { classifyAuthError, toApiError, type AuthFailure } from '../../auth/errors';
import { ROLE_LABELS } from '../../auth/validation';
import { consoleNav } from '../nav';

/**
 * The frame every business console page shares: navigation, who is signed in, and sign out. Pages
 * add their own search and actions; the sign-out button is always last and quiet.
 */
const props = defineProps<{ current: string }>();

const auth = useAuth();
const session = auth.session;
const failure = ref<AuthFailure | null>(null);
const loggingOut = ref(false);

const active = computed(() =>
  session.value?.memberships.find((m) => m.membershipId === session.value?.active?.membershipId),
);
const userRole = computed(() => {
  if (!active.value) return '';
  const role = ROLE_LABELS[active.value.role] ?? active.value.role;
  return `${active.value.businessName} · ${role}`;
});

async function logout() {
  loggingOut.value = true;
  try {
    await auth.logout();
  } catch (e) {
    failure.value = classifyAuthError(toApiError(e));
  } finally {
    loggingOut.value = false;
  }
  if (!session.value) await navigateTo(SIGNIN.business);
}
</script>

<template>
  <UiConsoleShell
    v-if="session"
    :brand-name="BRAND_NAME"
    :nav="consoleNav(props.current)"
    :nav-label="t('console.nav.label')"
    :user-name="session.user.name"
    :user-role="userRole"
  >
    <template v-if="$slots.search" #search><slot name="search" /></template>
    <template #actions>
      <slot name="actions" />
      <UiButton
        variant="tertiary"
        size="xs"
        icon="log-out"
        :loading="loggingOut"
        :loading-label="t('console.loggingOut')"
        @click="logout"
      >
        {{ t('console.logout') }}
      </UiButton>
    </template>
    <UiSystemState v-if="failure" kind="generic" />
    <slot />
  </UiConsoleShell>
  <UiSkeleton v-else variant="card" />
</template>
