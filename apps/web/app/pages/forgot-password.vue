<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../i18n';
import { useAuthApi } from '../modules/auth/composables/useAuth';
import { useSignupDraft } from '../modules/auth/composables/useSignupDraft';
import { toApiError } from '../modules/auth/errors';
import { maskEmail } from '../modules/auth/mask';
import { emailProblem } from '../modules/auth/validation';

/**
 * Step one of password reset. The answer is the same whether or not the address has an account
 * (the server never says), and the button is rate limited with a visible countdown that mirrors
 * the server (one request a minute per address).
 */
useHead({ title: t('forgot.title') });

const api = useAuthApi();
const countdown = useCountdown();

// Sign-in and sign-up hand over the address they already have (memory only); used once.
const draft = useSignupDraft();
const email = ref(draft.value.submittedEmail);
if (draft.value.submittedEmail) draft.value = { submittedEmail: '', portal: draft.value.portal };
const error = ref<string | undefined>();
const sending = ref(false);
const sentTo = ref('');
type Notice = { tone: 'ok' | 'error'; text: string };
const notice = ref<Notice | null>(null);

async function submit() {
  error.value = emailProblem(email.value);
  if (error.value || countdown.active.value) return;
  sending.value = true;
  notice.value = null;
  try {
    await api.forgotPassword(email.value.trim());
    sentTo.value = email.value.trim();
    notice.value = { tone: 'ok', text: t('forgot.sent', { email: maskEmail(sentTo.value) }) };
    countdown.start(60);
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'TOO_MANY_REQUESTS') {
      countdown.start(err.retryAfter ?? 60);
      notice.value = { tone: 'error', text: t('forgot.limited', { time: countdown.text.value }) };
    } else {
      notice.value = { tone: 'error', text: t('forgot.failed') };
    }
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UiAuthShell
    :breadcrumbs="[
      { label: t('nav.discover'), to: '/discover' },
      { label: t('nav.signin'), to: '/signin' },
      { label: t('forgot.title') },
    ]"
    :title="t('forgot.title')"
    :subtitle="t('forgot.subtitle')"
  >
    <form class="form" novalidate @submit.prevent="submit">
      <UiTextInput
        id="forgot-email"
        v-model="email"
        type="email"
        icon="mail"
        autocomplete="email"
        inputmode="email"
        required
        :label="t('forgot.email')"
        :error="error"
        @update:model-value="error = undefined"
      />
      <UiButton
        type="submit"
        block
        :loading="sending"
        :loading-label="t('forgot.submitting')"
        :disabled="countdown.active.value"
        :disabled-reason="
          countdown.active.value ? t('forgot.wait', { time: countdown.text.value }) : undefined
        "
      >
        {{ sentTo ? t('forgot.resend') : t('forgot.submit') }}
      </UiButton>
      <p
        v-if="notice"
        class="notice ui-text-body-s"
        :data-tone="notice.tone"
        :role="notice.tone === 'error' ? 'alert' : 'status'"
      >
        {{ notice.text }}
      </p>
    </form>
    <template #footer>
      <UiLink to="/signin">{{ t('forgot.back') }}</UiLink>
    </template>
  </UiAuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.notice {
  margin: 0;
  color: var(--ui-color-success-text);
  text-align: center;
}
.notice[data-tone='error'] {
  color: var(--ui-color-danger-text);
}
</style>
