<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { t } from '../../../i18n';
import { useAuth } from '../composables/useAuth';
import { HOME } from '../constants';

/**
 * Header actions for public pages. Those pages are server-rendered and edge-cached (R-WEB-05), so
 * the server always sends the signed-out buttons; after hydration the browser asks who is signed in
 * and swaps them for a Dashboard button. Nothing per-user is ever in the cached HTML.
 */
withDefaults(defineProps<{ signup?: boolean }>(), { signup: true });

const auth = useAuth();
const dashboard = computed(() =>
  auth.session.value ? HOME[auth.session.value.user.accountType] : null,
);

onMounted(() => {
  // A failed check leaves the signed-out buttons; the person can still sign in.
  void auth.ensure().catch(() => undefined);
});
</script>

<template>
  <UiButton v-if="dashboard" :to="dashboard" size="xs">{{ t('nav.dashboard') }}</UiButton>
  <template v-else>
    <UiButton to="/signin" variant="tertiary" size="xs">{{ t('nav.signin') }}</UiButton>
    <UiButton v-if="signup" to="/signup" size="xs">{{ t('nav.signup') }}</UiButton>
  </template>
</template>
