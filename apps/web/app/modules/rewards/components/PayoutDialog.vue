<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { toApiError } from '../../auth/errors';
import { referenceProblem } from '../businessLogic';
import { payoutErrorKey } from '../errors';
import { awardAmount } from '../logic';
import type { BusinessAward, PayoutDestination } from '../types';

/**
 * Sending one claimed reward. The full destination stays hidden until the person asks to see it, and the
 * server records that they did. After paying from their own account they enter their payment reference,
 * which is shown to the winner. The platform never moves the money.
 */
const props = defineProps<{
  award: BusinessAward | null;
  reveal: (awardId: string) => Promise<PayoutDestination>;
  submit: (awardId: string, reference: string) => Promise<void>;
}>();
const open = defineModel<boolean>('open', { required: true });

const destination = ref<PayoutDestination | null>(null);
const reference = ref('');
const problem = ref('');
const revealing = ref(false);
const loading = ref(false);
const touched = ref(false);

watch(open, (o) => {
  if (!o) return;
  destination.value = null;
  reference.value = '';
  problem.value = '';
  touched.value = false;
});

const referenceHint = computed(() => {
  const p = referenceProblem(reference.value);
  return touched.value && p ? t(`rewards.biz.pay.reference.${p}` as const) : '';
});
const prize = computed(() => (props.award ? (awardAmount(props.award) ?? '') : ''));

async function show() {
  if (!props.award) return;
  problem.value = '';
  revealing.value = true;
  try {
    destination.value = await props.reveal(props.award.id);
  } catch (e) {
    problem.value = t(payoutErrorKey(toApiError(e)));
  } finally {
    revealing.value = false;
  }
}

async function send() {
  touched.value = true;
  if (!props.award || referenceProblem(reference.value)) return;
  problem.value = '';
  loading.value = true;
  try {
    await props.submit(props.award.id, reference.value.trim());
    open.value = false;
  } catch (e) {
    problem.value = t(payoutErrorKey(toApiError(e)));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="t('rewards.biz.pay.title')"
    :description="t('rewards.biz.pay.body', { prize, name: award?.name ?? '' })"
  >
    <form class="form" novalidate @submit.prevent="send">
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>

      <div v-if="destination" class="details">
        <p class="ui-text-caption ui-text-hint">{{ t('rewards.biz.pay.method') }}</p>
        <p class="ui-text-label">{{ t(`rewards.method.${destination.method}` as const) }}</p>
        <p class="ui-text-caption ui-text-hint">{{ t('rewards.biz.pay.account') }}</p>
        <p class="ui-text-label">{{ destination.accountName }}</p>
        <p class="ui-text-caption ui-text-hint">{{ t('rewards.biz.pay.destination') }}</p>
        <p class="ui-text-label details__value">{{ destination.destination }}</p>
      </div>
      <div v-else class="details">
        <p class="ui-text-caption ui-text-hint">{{ t('rewards.biz.pay.reveal.hint') }}</p>
        <UiButton
          variant="secondary"
          size="xs"
          icon="eye"
          :loading="revealing"
          :loading-label="t('rewards.biz.pay.sending')"
          @click="show"
        >
          {{ t('rewards.biz.pay.reveal') }}
        </UiButton>
      </div>

      <UiTextInput
        id="payout-reference"
        v-model="reference"
        :label="t('rewards.biz.pay.reference')"
        :hint="referenceHint || t('rewards.biz.pay.reference.hint')"
        :error="referenceHint || undefined"
        :maxlength="80"
        autocomplete="off"
        required
      />
      <p class="ui-text-caption ui-text-hint">{{ t('rewards.biz.pay.never') }}</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" size="xs" @click="open = false">{{ t('cmp.close') }}</UiButton>
      <UiButton
        size="xs"
        :loading="loading"
        :loading-label="t('rewards.biz.pay.sending')"
        @click="send"
      >
        {{ t('rewards.biz.pay.submit') }}
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
.details {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-md);
}
.details p {
  margin: 0;
}
.details__value {
  overflow-wrap: anywhere;
}
</style>
