<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../../i18n';
import { useAuth } from '../composables/useAuth';
import { useSignupDraft } from '../composables/useSignupDraft';
import AuthFailureNotice from './AuthFailureNotice.vue';
import AuthPage from './AuthPage.vue';
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

// Coming from registration: the address is filled in (kept in memory, never in the URL) and
// used once, so only the password is left to type.
const draft = useSignupDraft();
const email = ref('');
const justRegistered = ref(false);
const passwordChanged = ref(false);
if (
  (draft.value.submittedEmail || draft.value.passwordReset) &&
  draft.value.portal === props.portal
) {
  email.value = draft.value.submittedEmail;
  justRegistered.value = !!draft.value.registered;
  passwordChanged.value = !!draft.value.passwordReset;
  draft.value = { submittedEmail: '', portal: props.portal };
}
const password = ref('');
/** "Forgot password?" starts with the address already typed here (in memory, not the URL). */
function carryEmail() {
  draft.value = { submittedEmail: email.value.trim(), portal: props.portal };
}
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
const crumbs = [
  { label: t('nav.discover'), to: '/discover' },
  { label: isBusiness ? t('footer.business.signin') : t('nav.signin') },
];
</script>

<template>
  <AuthPage
    :variant="portal"
    :breadcrumbs="crumbs"
    :title="isBusiness ? t('signin.title.business') : t('signin.title')"
    :subtitle="isBusiness ? t('signin.subtitle.business') : t('signin.subtitle')"
  >
    <UiBanner v-if="justRegistered" tone="info" :title="t('signin.created')" />
    <UiBanner v-if="passwordChanged" tone="info" :title="t('signin.passwordChanged')" />

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
      >
        <template #labelAside>
          <UiLink to="/forgot-password" @click="carryEmail">{{ t('signin.forgot') }}</UiLink>
        </template>
      </UiPasswordField>
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
    </template>
  </AuthPage>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
</style>
