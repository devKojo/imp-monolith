<script setup lang="ts">
import AuthPage from '../modules/auth/components/AuthPage.vue';
import { ref } from 'vue';
import { t } from '../i18n';
import { useAuthApi } from '../modules/auth/composables/useAuth';
import { useSignupDraft } from '../modules/auth/composables/useSignupDraft';
import { SIGNIN } from '../modules/auth/constants';
import { toApiError } from '../modules/auth/errors';
import { passwordProblem } from '../modules/auth/validation';

/**
 * Step two of password reset: the page behind the emailed link. The token is only read from the
 * address and sent in the request body; it is never stored. The link works once and expires, so a
 * bad or used link shows what to do next instead of a form. On success the person is sent to the
 * sign-in page of their own portal and types the new password there.
 */
useHead({ title: t('reset.title') });

const route = useRoute();
const api = useAuthApi();
const draft = useSignupDraft();
const countdown = useCountdown();

const token = typeof route.query.token === 'string' ? route.query.token : '';
const password = ref('');
const error = ref<string | undefined>();
const loading = ref(false);
const invalid = ref(!token);
const rateLimited = ref(false);
const failed = ref(false);

async function submit() {
  failed.value = false;
  rateLimited.value = false;
  error.value = passwordProblem(password.value, '');
  if (error.value || countdown.active.value) return;
  loading.value = true;
  try {
    const { accountType } = await api.resetPassword(token, password.value);
    const portal = accountType === 'BUSINESS' ? 'business' : 'participant';
    draft.value = { submittedEmail: '', portal, passwordReset: true };
    password.value = '';
    await navigateTo(SIGNIN[portal]);
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'INVALID_TOKEN') {
      invalid.value = true;
    } else if (err.code === 'WEAK_PASSWORD') {
      error.value = err.message.includes('breach')
        ? t('register.passwordBreached')
        : t('register.passwordRejected');
    } else if (err.code === 'TOO_MANY_REQUESTS') {
      rateLimited.value = true;
      countdown.start(err.retryAfter ?? 60);
    } else {
      failed.value = true;
    }
  } finally {
    loading.value = false; // the typed password is kept so nothing is lost on a recoverable failure
  }
}
</script>

<template>
  <AuthPage
    variant="general"
    :breadcrumbs="[
      { label: t('nav.discover'), to: '/discover' },
      { label: t('nav.signin'), to: '/signin' },
      { label: t('reset.title') },
    ]"
    :title="invalid ? t('reset.invalid.title') : t('reset.title')"
    :subtitle="invalid ? undefined : t('reset.subtitle')"
  >
    <template v-if="invalid">
      <p class="ui-text-body" role="alert">{{ t('reset.invalid.body') }}</p>
      <UiButton size="xs" to="/forgot-password" block icon-trailing="arrow-right">
        {{ t('reset.invalid.cta') }}
      </UiButton>
    </template>
    <form v-else class="form" novalidate @submit.prevent="submit">
      <UiPasswordField
        id="reset-password"
        v-model="password"
        autocomplete="new-password"
        required
        :label="t('reset.password')"
        :hint="t('register.passwordHint')"
        :error="error"
      />
      <UiButton
        size="xs"
        type="submit"
        block
        :loading="loading"
        :loading-label="t('reset.submitting')"
        :disabled="countdown.active.value"
        :disabled-reason="countdown.active.value ? t('common.waitCountdown') : undefined"
      >
        {{ t('reset.submit') }}
      </UiButton>
      <p v-if="rateLimited" class="problem ui-text-body-s" role="alert">
        {{ t('forgot.limited', { time: countdown.text.value }) }}
      </p>
      <p v-if="failed" class="problem ui-text-body-s" role="alert">{{ t('forgot.failed') }}</p>
    </form>
  </AuthPage>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.problem {
  margin: 0;
  color: var(--ui-color-danger-text);
  text-align: center;
}
</style>
