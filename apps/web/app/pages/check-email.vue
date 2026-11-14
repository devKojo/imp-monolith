<script setup lang="ts">
import AuthPage from '../modules/auth/components/AuthPage.vue';
import { computed, ref } from 'vue';
import { t } from '../i18n';
import { toApiError } from '../modules/auth/errors';
import { maskEmail } from '../modules/auth/mask';
import { useAuthApi } from '../modules/auth/composables/useAuth';
import { useSignupDraft } from '../modules/auth/composables/useSignupDraft';
import { SIGNIN } from '../modules/auth/constants';
import { emailProblem } from '../modules/auth/validation';

useHead({ title: t('checkEmail.title') });

const draft = useSignupDraft();
const api = useAuthApi();
const countdown = useCountdown();

// The address is only in memory, so after a reload it has to be typed again to resend.
const typed = ref('');
const address = computed(() => draft.value.submittedEmail || typed.value.trim());
const typedError = ref<string | undefined>();
const sending = ref(false);
type Notice = { tone: 'ok' | 'error'; text: string };
const notice = ref<Notice | null>(null);

// The server enforces one resend per address per minute and a small hourly cap; this mirrors it.
const COOLDOWN_SECONDS = 60;

async function resend() {
  if (!draft.value.submittedEmail) {
    typedError.value = emailProblem(typed.value);
    if (typedError.value) return;
  }
  sending.value = true;
  notice.value = null;
  try {
    await api.resendVerification(address.value);
    notice.value = { tone: 'ok', text: t('checkEmail.resent') };
    countdown.start(COOLDOWN_SECONDS);
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'TOO_MANY_REQUESTS') {
      countdown.start(err.retryAfter ?? COOLDOWN_SECONDS);
      notice.value = {
        tone: 'error',
        text: t('checkEmail.resendLimited', { time: countdown.text.value }),
      };
    } else {
      notice.value = { tone: 'error', text: t('checkEmail.resendFailed') };
    }
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AuthPage
    variant="general"
    :breadcrumbs="[{ label: t('nav.discover'), to: '/discover' }, { label: t('checkEmail.title') }]"
    :title="t('checkEmail.title')"
  >
    <p class="ui-text-body">
      {{
        draft.submittedEmail
          ? t('checkEmail.body', { email: maskEmail(draft.submittedEmail) })
          : t('checkEmail.bodyNoEmail')
      }}
    </p>

    <UiTextInput
      v-if="!draft.submittedEmail"
      id="resend-email"
      v-model="typed"
      type="email"
      icon="mail"
      autocomplete="email"
      inputmode="email"
      :label="t('checkEmail.resendEmail')"
      :error="typedError"
      @update:model-value="typedError = undefined"
    />
    <UiButton
      variant="secondary"
      block
      icon="mail"
      :loading="sending"
      :disabled="countdown.active.value"
      :disabled-reason="
        countdown.active.value
          ? t('checkEmail.resendWait', { time: countdown.text.value })
          : undefined
      "
      @click="resend"
    >
      {{ t('checkEmail.resend') }}
    </UiButton>
    <p
      v-if="notice"
      class="notice ui-text-body-s"
      :data-tone="notice.tone"
      :role="notice.tone === 'error' ? 'alert' : 'status'"
    >
      {{ notice.text }}
    </p>

    <UiButton :to="SIGNIN[draft.portal]" block icon-trailing="arrow-right" variant="tertiary">
      {{ t('checkEmail.signin') }}
    </UiButton>
  </AuthPage>
</template>

<style scoped>
.notice {
  margin: 0;
  color: var(--ui-color-success-text);
}
.notice[data-tone='error'] {
  color: var(--ui-color-danger-text);
}
</style>
