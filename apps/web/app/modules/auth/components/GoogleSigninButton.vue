<script setup lang="ts">
import { t } from '../../../i18n';

/**
 * "Continue with Google" for participants. Starts the server-side OAuth flow with a full page
 * navigation to the API (the browser leaves the app, so it cannot be a client-side route). Rendered
 * only when Google sign-in is enabled for this deployment.
 */
defineProps<{ note?: boolean }>();
const { public: config } = useRuntimeConfig();
const go = () => navigateTo('/api/v1/auth/google/start', { external: true });
</script>

<template>
  <div v-if="config.googleSignin" class="google">
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
