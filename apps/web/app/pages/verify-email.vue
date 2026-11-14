<script setup lang="ts">
import AuthPage from '../modules/auth/components/AuthPage.vue';
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n';
import { useAuth } from '../modules/auth/composables/useAuth';

/**
 * Landing page for the link in the verification email. The token is redeemed by a POST from the
 * browser after the page loads (never during SSR), so link scanners that only fetch the page do
 * not use up the single-use token.
 */
const route = useRoute();
const auth = useAuth();
const state = ref<'working' | 'ok' | 'bad'>('working');

useHead({ title: () => (state.value === 'ok' ? t('verify.ok.title') : t('verify.working')) });

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (!token) {
    state.value = 'bad';
    return;
  }
  try {
    await auth.verifyEmail(token);
    state.value = 'ok';
  } catch {
    state.value = 'bad';
  }
});
const title = computed(() =>
  state.value === 'ok'
    ? t('verify.ok.title')
    : state.value === 'bad'
      ? t('verify.bad.title')
      : t('verify.working'),
);
</script>

<template>
  <AuthPage
    variant="general"
    :breadcrumbs="[{ label: t('nav.discover'), to: '/discover' }, { label: title }]"
    :title="title"
  >
    <UiSkeleton v-if="state === 'working'" variant="text" :lines="2" />
    <template v-else-if="state === 'ok'">
      <p class="ui-text-body" role="status">{{ t('verify.ok.body') }}</p>
      <UiButton size="xs" to="/signin" block icon-trailing="arrow-right">{{
        t('verify.signin')
      }}</UiButton>
      <UiButton size="xs" to="/business/signin" block variant="secondary">{{
        t('verify.business')
      }}</UiButton>
    </template>
    <template v-else>
      <p class="ui-text-body" role="alert">{{ t('verify.bad.body') }}</p>
      <UiButton size="xs" to="/signin" block>{{ t('verify.signin') }}</UiButton>
      <UiButton size="xs" to="/signup" block variant="secondary">{{ t('verify.signup') }}</UiButton>
    </template>
  </AuthPage>
</template>
