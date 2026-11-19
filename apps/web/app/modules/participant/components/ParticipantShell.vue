<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../../i18n';
import { useAuth } from '../../auth/composables/useAuth';
import { BRAND_NAME, SIGNIN } from '../../auth/constants';

/**
 * The participant portal frame shared by Home (/me) and Rewards (/me/rewards): navigation, the
 * signed-in person and sign out. Pages put their content in the default slot.
 */
const props = defineProps<{ current: 'home' | 'rewards' }>();

const auth = useAuth();
const session = auth.session;
const loggingOut = ref(false);

const nav = [
  { label: t('me.nav.home'), to: '/me', current: props.current === 'home' },
  { label: t('me.nav.rewards'), to: '/me/rewards', current: props.current === 'rewards' },
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
    :portal-label="t('portal.participant')"
    @sign-out="logout"
  >
    <slot />
    <template #footer>
      <span>© {{ t('me.footer') }}</span>
    </template>
  </UiPortalShell>
  <UiSkeleton v-else variant="card" />
</template>
