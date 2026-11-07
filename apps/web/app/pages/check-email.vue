<script setup lang="ts">
import { t } from '../i18n';
import { useSignupDraft } from '../modules/auth/composables/useSignupDraft';
import { SIGNIN } from '../modules/auth/constants';

useHead({ title: t('checkEmail.title') });

const draft = useSignupDraft();
const isDev = import.meta.dev;
</script>

<template>
  <UiAuthShell
    :breadcrumbs="[{ label: t('nav.discover'), to: '/discover' }, { label: t('checkEmail.title') }]"
    :title="t('checkEmail.title')"
  >
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
