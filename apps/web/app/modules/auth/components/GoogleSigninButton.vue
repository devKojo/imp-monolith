<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '../../../i18n';
import { useAuthApi } from '../composables/useAuth';

/**
 * "Continue with Google" for participants. Starts the server-side OAuth flow with a full page
 * navigation to the API (the browser leaves the app, so it cannot be a client-side route). Shown
 * only when the API reports that Google sign-in is configured, so there is no separate web flag to
 * keep in sync. The check runs in the browser: auth pages never call the API while rendering on the
 * server.
 */
defineProps<{ note?: boolean }>();
const enabled = ref(false);
onMounted(async () => {
  try {
    enabled.value = (await useAuthApi().providers()).google;
  } catch {
    // The button is optional; email and password still work if this check fails.
  }
});
const go = () => navigateTo('/api/v1/auth/google/start', { external: true });
</script>

<template>
  <div v-if="enabled" class="google">
    <UiButton variant="secondary" block icon="log-in" @click="go">
      {{ t('auth.google.continue') }}
    </UiButton>
    <p v-if="note" class="ui-text-caption ui-text-hint">{{ t('auth.google.terms') }}</p>
    <UiDivider :label="t('auth.or')" />
  </div>
</template>

<style scoped>
.google {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.google p {
  margin: 0;
  text-align: center;
}
</style>
