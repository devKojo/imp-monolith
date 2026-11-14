<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../../i18n';
import { useAuth, useAuthApi } from '../composables/useAuth';
import { toApiError } from '../errors';
import { maskEmail } from '../mask';

/**
 * Optional email verification for a signed-in participant. Participants can use their account
 * without it; this offers to send the link and disappears once the address is verified. Rate
 * limited by the server (one a minute); the countdown mirrors that.
 */
const auth = useAuth();
const api = useAuthApi();
const countdown = useCountdown();
const sending = ref(false);
type Notice = { tone: 'ok' | 'error'; text: string };
const notice = ref<Notice | null>(null);

async function send() {
  const session = auth.session.value;
  if (!session) return;
  sending.value = true;
  notice.value = null;
  try {
    const out = await api.sendVerification(session.csrfToken);
    if (out.status === 'already_verified') {
      await auth.refresh();
      return;
    }
    notice.value = {
      tone: 'ok',
      text: t('me.verify.sent', { email: maskEmail(session.user.email) }),
    };
    countdown.start(60);
  } catch (e) {
    const err = toApiError(e);
    if (err.code === 'TOO_MANY_REQUESTS') {
      countdown.start(err.retryAfter ?? 60);
      notice.value = {
        tone: 'error',
        text: t('me.verify.limited', { time: countdown.text.value }),
      };
    } else {
      notice.value = { tone: 'error', text: t('me.verify.failed') };
    }
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UiBanner
    v-if="auth.session.value && !auth.session.value.user.emailVerified"
    tone="info"
    :title="t('me.verify.title')"
  >
    {{ t('me.verify.body') }}
    <template #actions>
      <UiButton
        size="xs"
        variant="secondary"
        icon="mail"
        :loading="sending"
        :disabled="countdown.active.value"
        :disabled-reason="
          countdown.active.value ? t('me.verify.wait', { time: countdown.text.value }) : undefined
        "
        @click="send"
      >
        {{ t('me.verify.send') }}
      </UiButton>
      <p v-if="notice" class="notice ui-text-body-s" :data-tone="notice.tone" role="status">
        {{ notice.text }}
      </p>
    </template>
  </UiBanner>
</template>

<style scoped>
.notice {
  margin: var(--ui-space-2) 0 0;
}
.notice[data-tone='error'] {
  color: var(--ui-color-danger-text);
}
</style>
