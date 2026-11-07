<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../../i18n';
import { useAuth } from '../composables/useAuth';
import AuthFailureNotice from './AuthFailureNotice.vue';
import GoogleSigninButton from './GoogleSigninButton.vue';
import { HOME } from '../constants';
import type { Portal } from '../types';
import { classifyAuthError, toApiError, type AuthFailure } from '../errors';
import {
  compact,
  emailProblem,
  safeRedirect,
  signinPasswordProblem,
  type FieldErrors,
} from '../validation';

const props = defineProps<{ portal: Portal }>();
const isBusiness = props.portal === 'business';
useHead({ title: t('signin.title') });

const route = useRoute();
const auth = useAuth();
const countdown = useCountdown();

const email = ref('');
const password = ref('');
const errors = ref<FieldErrors<'email' | 'password'>>({});
const failure = ref<AuthFailure | null>(null);
const loading = ref(false);
useClearOnInput(errors, { email, password });

// Only same-site relative paths are followed after sign-in (open-redirect protection).
const home = HOME[isBusiness ? 'BUSINESS' : 'PARTICIPANT'];
const next = computed(() => safeRedirect(route.query.next, home));

const summary = computed(() =>
  Object.entries(errors.value).map(([field, message]) => ({
    fieldId: `signin-${field}`,
    message: message ?? '',
  })),
);

// Already signed in? Skip the form. Runs in the browser only (never SSR, so no cookies on the SSR tier).
onMounted(async () => {
  try {
    const existing = await auth.ensure();
    if (existing) await navigateTo(HOME[existing.user.accountType]);
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
    await auth.login(email.value.trim(), password.value, props.portal);
    await navigateTo(next.value);
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    failure.value = f;
    if (f.kind === 'rate-limited' || f.kind === 'busy') countdown.start(f.retryAfter);
  } finally {
    loading.value = false; // input is kept so nothing is lost on a recoverable failure
  }
}
// The API sends people back here with ?error= when Google sign-in did not complete.
const googleError = computed(() => {
  const e = route.query.error;
  return e === 'google' || e === 'google_business' ? e : null;
});

const crumbs = [
  { label: t('nav.discover'), to: '/discover' },
  { label: isBusiness ? t('footer.business.signin') : t('nav.signin') },
];
</script>

<template>
  <UiAuthShell
    :breadcrumbs="crumbs"
    :title="t('signin.title')"
    :subtitle="isBusiness ? t('signin.subtitle.business') : t('signin.subtitle')"
  >
    <UiBanner
      v-if="googleError"
      tone="error"
      :title="
        googleError === 'google_business' ? t('auth.google.business') : t('auth.google.error')
      "
    />
    <GoogleSigninButton v-if="!isBusiness" />

    <form class="form" novalidate @submit.prevent="submit">
      <UiErrorSummary :errors="summary" />
      <AuthFailureNotice
        :failure="failure"
        :countdown="countdown.text.value"
        :portal="portal"
        @retry="submit"
      />
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
      <UiLink :to="isBusiness ? '/business/register' : '/signup'">{{
        t('signin.createAccount')
      }}</UiLink>
    </template>
    <template #below>
      <span>{{ t('signin.sessionNote') }}</span>
      <UiLink :to="isBusiness ? '/signin' : '/business/signin'" bare>{{
        isBusiness ? t('signin.switch.participant') : t('signin.switch.business')
      }}</UiLink>
    </template>
  </UiAuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
</style>
