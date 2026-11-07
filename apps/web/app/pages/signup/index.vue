<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { t } from '../../i18n';
import { useAuth } from '../../modules/auth/composables/useAuth';
import { useSignupDraft } from '../../modules/auth/composables/useSignupDraft';
import { BRAND_NAME } from '../../modules/auth/constants';
import {
  compact,
  emailProblem,
  nameProblem,
  passwordProblem,
  passwordRules,
  type FieldErrors,
} from '../../modules/auth/validation';

useHead({ title: t('signup.title') });

const auth = useAuth();
const draft = useSignupDraft();

const name = ref(draft.value.name);
const email = ref(draft.value.email);
const password = ref(draft.value.password);
const errors = ref<FieldErrors<'name' | 'email' | 'password'>>({});
// A server rejection from step 2 (for example a breached password) is shown on the password field.
if (draft.value.passwordError) errors.value = { password: draft.value.passwordError };

const rules = computed(() => passwordRules(password.value, email.value));
const summary = computed(() =>
  Object.entries(errors.value).map(([field, message]) => ({
    fieldId: `signup-${field}`,
    message: message ?? '',
  })),
);

onMounted(async () => {
  try {
    if (await auth.ensure()) await navigateTo('/app');
  } catch {
    /* API unreachable: signing up is still possible; submit will explain */
  }
});

const steps = [
  { id: 'account', label: t('steps.account') },
  { id: 'business', label: t('steps.business') },
];

async function submit() {
  errors.value = compact({
    name: nameProblem(name.value),
    email: emailProblem(email.value),
    password: passwordProblem(password.value, email.value),
  });
  if (Object.keys(errors.value).length > 0) return;
  // Held in memory for step 2 only; never written to browser storage.
  draft.value = {
    ...draft.value,
    name: name.value.trim(),
    email: email.value.trim(),
    password: password.value,
    passwordError: '',
  };
  await navigateTo('/signup/business');
}
</script>

<template>
  <UiAuthShell
    size="wide"
    :brand-name="BRAND_NAME"
    :title="t('signup.title')"
    :subtitle="t('signup.subtitle')"
  >
    <template #aside>
      <h2 class="aside-title ui-text-h2">{{ t('signup.aside.title') }}</h2>
      <div class="aside-tiles">
        <UiFeatureTile
          icon="clipboard-list"
          :title="t('signup.aside.campaigns.title')"
          :description="t('signup.aside.campaigns.body')"
        />
        <UiFeatureTile
          icon="shield-check"
          :title="t('signup.aside.draws.title')"
          :description="t('signup.aside.draws.body')"
        />
        <UiFeatureTile
          icon="lock"
          :title="t('signup.aside.privacy.title')"
          :description="t('signup.aside.privacy.body')"
        />
      </div>
    </template>

    <form class="form" novalidate @submit.prevent="submit">
      <UiStepper :steps="steps" current="account" />
      <UiErrorSummary :errors="summary" />
      <UiTextInput
        id="signup-name"
        v-model="name"
        icon="user"
        autocomplete="name"
        required
        :label="t('signup.name')"
        :error="errors.name"
      />
      <UiTextInput
        id="signup-email"
        v-model="email"
        type="email"
        icon="mail"
        autocomplete="email"
        inputmode="email"
        required
        :label="t('signup.email')"
        :hint="t('signup.emailHint')"
        :error="errors.email"
      />
      <UiPasswordField
        id="signup-password"
        v-model="password"
        autocomplete="new-password"
        required
        :label="t('signup.password')"
        :hint="t('signup.passwordHint')"
        :error="errors.password"
        :rules="rules"
      />
      <UiButton type="submit" block icon-trailing="arrow-right">{{
        t('signup.continue')
      }}</UiButton>
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
.aside-title {
  margin: 0 0 var(--ui-space-4);
}
.aside-tiles {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
</style>
