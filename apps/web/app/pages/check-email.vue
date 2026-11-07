<script setup lang="ts">
import { t } from '../i18n';
import { useSignupDraft } from '../modules/auth/composables/useSignupDraft';
import { BRAND_NAME, SIGNIN } from '../modules/auth/constants';

useHead({ title: t('checkEmail.title') });

const draft = useSignupDraft();
const isDev = import.meta.dev;
</script>

<template>
  <UiAuthShell :brand-name="BRAND_NAME" :title="t('checkEmail.title')">
    <template #badge>
      <UiBadge shape="pill" tone="success" icon="mail">{{ t('checkEmail.badge') }}</UiBadge>
    </template>
    <p class="ui-text-body">
      {{
        draft.submittedEmail
          ? t('checkEmail.body', { email: draft.submittedEmail })
          : t('checkEmail.bodyNoEmail')
      }}
    </p>
    <UiBanner v-if="isDev" tone="system">{{ t('checkEmail.dev') }}</UiBanner>
    <UiButton :to="SIGNIN[draft.portal]" block icon-trailing="arrow-right" variant="secondary">
      {{ t('checkEmail.signin') }}
    </UiButton>
  </UiAuthShell>
</template>
