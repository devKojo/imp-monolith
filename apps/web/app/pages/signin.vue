<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n';
import { useAuth } from '../modules/auth/composables/useAuth';
import AuthFailureNotice from '../modules/auth/components/AuthFailureNotice.vue';
import { BRAND_NAME } from '../modules/auth/constants';
import { classifyAuthError, toApiError, type AuthFailure } from '../modules/auth/errors';
import {
  compact,
  emailProblem,
  safeRedirect,
  signinPasswordProblem,
  type FieldErrors,
} from '../modules/auth/validation';

useHead({ title: t('signin.title') });

const route = useRoute();
const auth = useAuth();
const countdown = useCountdown();

const email = ref('');
const password = ref('');
const errors = ref<FieldErrors<'email' | 'password'>>({});
const failure = ref<AuthFailure | null>(null);
const loading = ref(false);

// Only same-site relative paths are followed after sign-in (open-redirect protection).
const next = computed(() => safeRedirect(route.query.next));

const summary = computed(() =>
  Object.entries(errors.value).map(([field, message]) => ({
    fieldId: `signin-${field}`,
    message: message ?? '',
  })),
);

// Already signed in? Skip the form. Runs in the browser only (never SSR, so no cookies on the SSR tier).
onMounted(async () => {
  try {
    if (await auth.ensure()) await navigateTo(next.value);
  } catch {
    /* API unreachable: the form is still usable and will explain on submit */
  }
});

async function submit() {
  failure.value = null;
  errors.value = compact({
    email: emailProblem(email.value),
    password: signinPasswordProblem(password.value),
  });
  if (Object.keys(errors.value).length > 0 || countdown.active.value) return;

  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    await navigateTo(next.value);
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    failure.value = f;
    if (f.kind === 'rate-limited' || f.kind === 'busy') countdown.start(f.retryAfter);
  } finally {
    loading.value = false; // input is kept so nothing is lost on a recoverable failure
  }
}
</script>

<template>
  <UiAuthShell :brand-name="BRAND_NAME" :title="t('signin.title')" :subtitle="t('signin.subtitle')">
    <template #badge>
      <UiBadge shape="pill" tone="info" icon="shield-check">{{ t('signin.badge') }}</UiBadge>
    </template>

    <form class="form" novalidate @submit.prevent="submit">
      <UiErrorSummary :errors="summary" />
      <AuthFailureNotice :failure="failure" :countdown="countdown.text.value" @retry="submit" />
      <UiTextInput
        id="signin-email"
        v-model="email"
        type="email"
        icon="mail"
        autocomplete="email"
        inputmode="email"
        required
        :label="t('signin.email')"
        :error="errors.email"
      />
      <UiPasswordField
        id="signin-password"
        v-model="password"
        autocomplete="current-password"
        required
        :label="t('signin.password')"
        :error="errors.password"
      />
      <UiButton
        type="submit"
        block
        icon-trailing="arrow-right"
        :loading="loading"
        :loading-label="t('signin.submitting')"
        :disabled="countdown.active.value"
        :disabled-reason="countdown.active.value ? t('common.waitCountdown') : undefined"
      >
        {{ t('signin.submit') }}
      </UiButton>
    </form>

    <template #footer>
      {{ t('signin.noAccount') }}
      <UiLink to="/signup">{{ t('signin.createAccount') }}</UiLink>
    </template>
    <template #below>{{ t('signin.sessionNote') }}</template>
  </UiAuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
</style>
