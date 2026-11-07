<script setup lang="ts">
import { t } from '../../../i18n';
import type { AuthFailure } from '../errors';
import type { Portal } from '../types';

/**
 * Presents a failed auth call as the matching state from the UI spec's section 11 matrix. Field
 * level problems (validation, weak password) are shown by the form itself, not here. Messages never
 * say whether an account exists (UI-CPY-03).
 */
defineProps<{
  failure: AuthFailure | null;
  /** The portal the form belongs to, used to point a wrong-portal user at the other one. */
  portal?: Portal;
  /** Remaining time text (m:ss) for rate limits; the page owns the countdown. */
  countdown?: string;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="failure" class="notice">
    <UiBanner
      v-if="failure.kind === 'invalid-credentials'"
      tone="error"
      :title="t('signin.invalid')"
    />
    <UiBanner
      v-else-if="failure.kind === 'wrong-portal'"
      tone="warning"
      :title="
        portal === 'business' ? t('wrongPortal.business.title') : t('wrongPortal.participant.title')
      "
    >
      {{
        portal === 'business' ? t('wrongPortal.business.body') : t('wrongPortal.participant.body')
      }}
      <UiLink :to="portal === 'business' ? '/signin' : '/business/signin'">{{
        portal === 'business'
          ? t('wrongPortal.business.action')
          : t('wrongPortal.participant.action')
      }}</UiLink>
    </UiBanner>
    <UiBanner
      v-else-if="failure.kind === 'email-not-verified'"
      tone="warning"
      :title="t('signin.unverified.title')"
    >
      {{ t('signin.unverified.body') }}
    </UiBanner>
    <UiSystemState
      v-else-if="failure.kind === 'rate-limited'"
      kind="rateLimited"
      :params="{ time: countdown ?? '' }"
    />
    <UiSystemState v-else-if="failure.kind === 'busy'" kind="busy" />
    <UiSystemState v-else-if="failure.kind === 'offline'" kind="offline" @action="emit('retry')" />
    <UiSystemState
      v-else-if="failure.kind === 'unauthenticated'"
      kind="unauthenticated"
      @action="emit('retry')"
    />
    <UiSystemState
      v-else-if="failure.kind === 'csrf' || failure.kind === 'generic'"
      kind="generic"
      @action="emit('retry')"
    />
  </div>
</template>
