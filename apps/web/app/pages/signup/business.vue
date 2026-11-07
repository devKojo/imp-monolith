<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ConsentValue } from '@imp/ui/app/components/UiConsentGroup.vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { useSignupDraft } from '../../modules/auth/composables/useSignupDraft';
import AuthFailureNotice from '../../modules/auth/components/AuthFailureNotice.vue';
import { AGREEMENT_VERSION, BRAND_NAME } from '../../modules/auth/constants';
import { classifyAuthError, toApiError, type AuthFailure } from '../../modules/auth/errors';
import { businessNameProblem, compact, type FieldErrors } from '../../modules/auth/validation';

useHead({ title: t('business.title') });

const auth = useAuth();
const draft = useSignupDraft();
const countdown = useCountdown();

const businessName = ref('');
const consent = ref<ConsentValue>({ accepted: false, optional: {} });
const errors = ref<FieldErrors<'businessName' | 'agreement'>>({});
const failure = ref<AuthFailure | null>(null);
const loading = ref(false);
useClearOnInput(errors, { businessName, agreement: computed(() => consent.value.accepted) });

// Step 1 lives in memory only; after a reload there is nothing to submit, so start again.
onMounted(() => {
  if (!draft.value.email || !draft.value.password) navigateTo('/signup');
});

const steps = [
  { id: 'account', label: t('steps.account') },
  { id: 'business', label: t('steps.business') },
];

const summary = computed(() =>
  Object.entries(errors.value).map(([field, message]) => ({
    fieldId: field === 'agreement' ? 'agreement-check' : 'business-name',
    message: message ?? '',
  })),
);

async function submit() {
  failure.value = null;
  errors.value = compact({
    businessName: businessNameProblem(businessName.value),
    agreement: consent.value.accepted ? undefined : t('business.agreementError'),
  });
  if (Object.keys(errors.value).length > 0 || countdown.active.value) return;

  loading.value = true;
  try {
    await auth.register({
      name: draft.value.name,
      email: draft.value.email,
      password: draft.value.password,
      businessName: businessName.value.trim(),
      agreement: { accepted: true, version: AGREEMENT_VERSION },
    });
    // Keep only the address for the confirmation page; drop the password immediately.
    draft.value = {
      name: '',
      email: '',
      password: '',
      submittedEmail: draft.value.email,
      passwordError: '',
    };
    await navigateTo('/signup/check-email');
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'weak-password') {
      // The server also checks known breaches; send the user back to fix the password.
      draft.value.passwordError = f.message.includes('breach')
        ? t('signup.passwordBreached')
        : t('signup.passwordRejected');
      await navigateTo('/signup');
    } else if (f.kind === 'validation') {
      errors.value = compact({ businessName: f.fields.businessName });
      failure.value = Object.keys(errors.value).length ? null : { kind: 'generic' };
    } else {
      failure.value = f;
      if (f.kind === 'rate-limited' || f.kind === 'busy') countdown.start(f.retryAfter);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UiAuthShell
    :brand-name="BRAND_NAME"
    :title="t('business.title')"
    :subtitle="t('business.subtitle')"
  >
    <form class="form" novalidate @submit.prevent="submit">
      <UiStepper :steps="steps" current="business" />
      <UiErrorSummary :errors="summary" />
      <AuthFailureNotice :failure="failure" :countdown="countdown.text.value" @retry="submit" />

      <p v-if="draft.email" class="account ui-text-body-s">
        <span class="ui-text-hint">{{ t('business.accountFor') }}</span>
        <strong>{{ draft.name }}</strong> ({{ draft.email }})
        <UiLink to="/signup">{{ t('business.change') }}</UiLink>
      </p>

      <UiTextInput
        id="business-name"
        v-model="businessName"
        icon="building"
        autocomplete="organization"
        required
        :label="t('business.name')"
        :hint="t('business.nameHint')"
        :error="errors.businessName"
      />

      <UiConsentGroup
        v-model="consent"
        terms-id="agreement-check"
        :legend="t('business.agreementLegend')"
        :error="errors.agreement"
        :terms="{ label: t('business.agreement'), version: AGREEMENT_VERSION, href: '/terms' }"
      />

      <UiButton
        type="submit"
        block
        icon-trailing="arrow-right"
        :loading="loading"
        :loading-label="t('business.submitting')"
        :disabled="countdown.active.value"
        :disabled-reason="countdown.active.value ? t('common.waitCountdown') : undefined"
      >
        {{ t('business.submit') }}
      </UiButton>
    </form>

    <template #footer>
      {{ t('signup.haveAccount') }}
      <UiLink to="/signin">{{ t('signup.signin') }}</UiLink>
    </template>
  </UiAuthShell>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.account {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1) var(--ui-space-2);
  margin: 0;
}
</style>
