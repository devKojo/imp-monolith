<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { toApiError } from '../../auth/errors';
import { claimErrorKey } from '../errors';
import { awardAmount, PAYOUT_METHODS } from '../logic';
import type { ClaimInput, MyAward, PayoutMethod } from '../types';

/**
 * Where to send a cash or item reward. The person says how they want it, where, and re-enters their
 * password: claiming moves value, so a stolen session alone must not be enough. The server checks all of
 * it again; what it rejects is shown here and nothing typed is lost.
 */
const props = defineProps<{
  award: MyAward | null;
  submit: (input: ClaimInput) => Promise<void>;
}>();
const open = defineModel<boolean>('open', { required: true });

const method = ref<PayoutMethod>('MOBILE_MONEY');
const accountName = ref('');
const destination = ref('');
const password = ref('');
const problem = ref('');
const loading = ref(false);

watch(open, (o) => {
  if (!o) return;
  problem.value = '';
  password.value = ''; // never kept from one attempt to the next
});

const destinationLabel = computed(() =>
  t(
    method.value === 'MOBILE_MONEY'
      ? 'rewards.claim.destination.mobile'
      : method.value === 'BANK_TRANSFER'
        ? 'rewards.claim.destination.bank'
        : 'rewards.claim.destination.delivery',
  ),
);
const methods = computed(() =>
  PAYOUT_METHODS.map((m) => ({ value: m, label: t(`rewards.method.${m}` as const) })),
);
const value = computed(() => (props.award ? awardAmount(props.award) : null));

async function send() {
  problem.value = '';
  loading.value = true;
  try {
    await props.submit({
      method: method.value,
      accountName: accountName.value,
      destination: destination.value,
      password: password.value,
    });
    open.value = false;
  } catch (e) {
    const err = toApiError(e);
    // The server's own words for what to fix; everything else uses the shared lines.
    problem.value = err.code === 'CLAIM_INVALID' ? err.message : t(claimErrorKey(err));
  } finally {
    password.value = '';
    loading.value = false;
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="t('rewards.claim.title')"
    :description="
      t('rewards.claim.body', { prize: award?.prizeName ?? award?.campaign.title ?? '' })
    "
  >
    <form class="form" novalidate @submit.prevent="send">
      <p v-if="value" class="ui-text-h3">{{ value }}</p>
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiSelect
        id="claim-method"
        v-model="method"
        :label="t('rewards.claim.method')"
        :options="methods"
        required
      />
      <UiTextInput
        id="claim-name"
        v-model="accountName"
        :label="t('rewards.claim.name')"
        autocomplete="name"
        required
      />
      <UiTextInput
        id="claim-destination"
        v-model="destination"
        :label="destinationLabel"
        :multiline="method === 'DELIVERY'"
        :inputmode="method === 'DELIVERY' ? 'text' : 'tel'"
        autocomplete="off"
        required
      />
      <UiPasswordField
        id="claim-password"
        v-model="password"
        autocomplete="current-password"
        :label="t('rewards.claim.password')"
        :hint="t('rewards.claim.passwordHint')"
        required
      />
      <p class="ui-text-caption ui-text-hint">{{ t('rewards.claim.never') }}</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" size="xs" @click="open = false">{{ t('cmp.close') }}</UiButton>
      <UiButton
        size="xs"
        :loading="loading"
        :loading-label="t('rewards.claim.sending')"
        @click="send"
      >
        {{ t('rewards.claim.submit') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}
.form p {
  margin: 0;
}
</style>
