<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ConsentValue } from '@imp/ui/app/components/UiConsentGroup.vue';
import { t, type AppTextKey } from '../../../i18n';
import { useAuth } from '../composables/useAuth';
import { useSignupDraft } from '../composables/useSignupDraft';
import AuthFailureNotice from './AuthFailureNotice.vue';
import GoogleSigninButton from './GoogleSigninButton.vue';
import { AGREEMENT_VERSION, HOME, SIGNIN } from '../constants';
import { classifyAuthError, toApiError, type AuthFailure } from '../errors';
import {
  businessNameProblem,
  compact,
  emailProblem,
  nameProblem,
  passwordProblem,
  passwordRules,
  type FieldErrors,
} from '../validation';
import type { Portal } from '../types';

/**
 * One registration form for both portals. A participant needs only an account to take part in
 * campaigns; a business also names the business it creates (ADR-P001). The two share validation,
 * failure handling and the agreement gate, and differ in fields, endpoint and destination.
 */
const props = defineProps<{ portal: Portal }>();
const isBusiness = props.portal === 'business';
const k = (key: string) =>
  t(`${isBusiness ? 'register.business' : 'register.participant'}.${key}` as AppTextKey);

useHead({ title: k('title') });

const auth = useAuth();
const draft = useSignupDraft();
const countdown = useCountdown();

const businessName = ref('');
const name = ref('');
const email = ref('');
const password = ref('');
const consent = ref<ConsentValue>({ accepted: false, optional: {} });
type Field = 'businessName' | 'name' | 'email' | 'password' | 'agreement';
const errors = ref<FieldErrors<Field>>({});
const failure = ref<AuthFailure | null>(null);
const loading = ref(false);
useClearOnInput(errors, {
  businessName,
  name,
  email,
  password,
  agreement: computed(() => consent.value.accepted),
});

const rules = computed(() => passwordRules(password.value, email.value));
const fieldIds: Record<Field, string> = {
  businessName: 'register-business',
  name: 'register-name',
  email: 'register-email',
  password: 'register-password',
  agreement: 'agreement-check',
};
const summary = computed(() =>
  Object.entries(errors.value).map(([field, message]) => ({
    fieldId: fieldIds[field as Field],
    message: message ?? '',
  })),
);

onMounted(async () => {
  try {
    const existing = await auth.ensure();
    if (existing) await navigateTo(HOME[existing.user.accountType]);
  } catch {
    /* API unreachable: registering is still possible; submit will explain */
  }
});

/** Hands the typed address to the sign-in / forgot-password pages (memory only, never the URL). */
function carryEmail() {
  draft.value = { submittedEmail: email.value.trim(), portal: props.portal };
}

async function submit() {
  failure.value = null;
  errors.value = compact({
    businessName: isBusiness ? businessNameProblem(businessName.value) : undefined,
    name: nameProblem(name.value),
    email: emailProblem(email.value),
    password: passwordProblem(password.value, email.value),
    agreement: consent.value.accepted ? undefined : t('register.agreementError'),
  });
  if (Object.keys(errors.value).length > 0 || countdown.active.value) return;

  loading.value = true;
  const agreement = { accepted: true as const, version: AGREEMENT_VERSION };
  const base = { name: name.value.trim(), email: email.value.trim(), password: password.value };
  try {
    if (isBusiness) {
      await auth.register({ ...base, businessName: businessName.value.trim(), agreement });
      // Keep only the address for the confirmation page; the password is dropped immediately.
      draft.value = { submittedEmail: base.email, portal: props.portal };
      password.value = '';
      await navigateTo('/check-email');
    } else {
      // No email verification for participants, and no automatic sign-in: send them to the
      // sign-in page with the address filled in and let them type the password themselves. The
      // address travels in memory only (never the URL); the password is dropped immediately.
      await auth.registerParticipant({ ...base, agreement });
      draft.value = { submittedEmail: base.email, portal: 'participant', registered: true };
      password.value = '';
      await navigateTo(SIGNIN.participant);
    }
  } catch (e) {
    const f = classifyAuthError(toApiError(e));
    if (f.kind === 'weak-password') {
      errors.value = {
        password: f.message.includes('breach')
          ? t('register.passwordBreached')
          : t('register.passwordRejected'),
      };
    } else if (f.kind === 'email-taken') {
      errors.value = { email: t('register.emailTaken') };
      carryEmail(); // sign-in and "forgot password" then open with this address filled in
    } else if (f.kind === 'validation') {
      errors.value = compact({
        businessName: f.fields.businessName,
        name: f.fields.name,
        email: f.fields.email,
      });
      failure.value = Object.keys(errors.value).length ? null : { kind: 'generic' };
    } else {
      failure.value = f;
      if (f.kind === 'rate-limited' || f.kind === 'busy') countdown.start(f.retryAfter);
    }
  } finally {
    loading.value = false; // input is kept so nothing is lost on a recoverable failure
  }
}
const crumbs = [
  { label: t('nav.discover'), to: '/discover' },
  { label: isBusiness ? t('footer.business.register') : t('nav.signup') },
];
</script>

<template>
  <UiAuthShell
    :size="isBusiness ? 'wide' : 'narrow'"
    :breadcrumbs="crumbs"
    :title="k('title')"
    :subtitle="k('subtitle')"
  >
    <GoogleSigninButton v-if="!isBusiness" note />

    <form class="form" novalidate @submit.prevent="submit">
      <UiErrorSummary :errors="summary" />
      <AuthFailureNotice
        :failure="failure"
        :countdown="countdown.text.value"
        :portal="portal"
        @retry="submit"
      />

      <UiTextInput
        v-if="isBusiness"
        id="register-business"
        v-model="businessName"
        icon="building"
        autocomplete="organization"
        required
        :label="t('register.business.name')"
        :hint="t('register.business.nameHint')"
        :error="errors.businessName"
      />
      <div :class="isBusiness ? 'row' : 'stack'">
        <UiTextInput
          id="register-name"
          v-model="name"
          icon="user"
          autocomplete="name"
          required
          :label="isBusiness ? t('register.business.adminName') : t('register.participant.name')"
          :error="errors.name"
        />
        <UiTextInput
          id="register-email"
          v-model="email"
          type="email"
          icon="mail"
          autocomplete="email"
          inputmode="email"
          required
          :label="k('email')"
          :hint="isBusiness ? undefined : t('register.emailHint')"
          :error="errors.email"
        />
      </div>
      <UiPasswordField
        id="register-password"
        v-model="password"
        autocomplete="new-password"
        required
        :label="t('register.password')"
        :hint="t('register.passwordHint')"
        :error="errors.password"
        :rules="rules"
      />

      <UiConsentGroup
        v-model="consent"
        terms-id="agreement-check"
        :legend="t('register.agreementLegend')"
        :error="errors.agreement"
        :terms="{ label: k('agreement'), version: AGREEMENT_VERSION, href: '/terms' }"
      />

      <UiButton
        type="submit"
        block
        icon-trailing="arrow-right"
        :loading="loading"
        :loading-label="t('register.submitting')"
        :disabled="countdown.active.value"
        :disabled-reason="countdown.active.value ? t('common.waitCountdown') : undefined"
      >
        {{ k('submit') }}
      </UiButton>
    </form>

    <template #footer>
      {{ k('haveAccount') }}
      <UiLink :to="isBusiness ? '/business/signin' : '/signin'" @click="carryEmail">{{
        k('signin')
      }}</UiLink>
    </template>
    <template #below>
      <UiLink :to="isBusiness ? '/signup' : '/business/register'" bare>{{
        isBusiness ? t('register.switch.participant') : t('register.switch.business')
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
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-4);
}
@media (min-width: 640px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
