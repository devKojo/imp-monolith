<script setup lang="ts">
import { computed, ref } from 'vue';
import type { NavItem } from '@imp/ui/app/components/UiSidebarNav.vue';
import { t } from '../../../i18n';
import { useAuth } from '../../auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../auth/constants';

/** The frame for platform review pages: its own two-item menu, who is signed in, and sign out. */
const props = defineProps<{ current: 'awards' | 'reports' }>();

const auth = useAuth();
const session = auth.session;
const loggingOut = ref(false);

const nav = computed<NavItem[]>(() => [
  {
    label: t('platform.nav.awards'),
    to: '/app/platform',
    icon: 'shield-check',
    current: props.current === 'awards',
  },
  {
    label: t('platform.nav.reports'),
    to: '/app/platform/reports',
    icon: 'alert-triangle',
    current: props.current === 'reports',
  },
]);

async function logout() {
  loggingOut.value = true;
  try {
    await auth.logout();
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
    :nav="nav"
    :nav-label="t('console.nav.label')"
    :user-name="session.user.name"
    :user-role="t('platform.role')"
    :portal-label="t('platform.portal')"
  >
    <template #actions>
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
    <slot />
  </UiConsoleShell>
  <UiSkeleton v-else variant="card" />
</template>
