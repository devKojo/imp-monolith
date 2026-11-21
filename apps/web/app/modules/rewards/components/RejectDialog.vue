<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { toApiError } from '../../auth/errors';
import { payoutErrorKey } from '../errors';
import type { BusinessAward, RejectReason } from '../types';

/**
 * Rejecting an award the risk rules held. A reason is required and recorded in the award's history. The
 * server decides whether it is still waiting for review; what it refuses is shown here.
 */
const props = defineProps<{
  award: BusinessAward | null;
  submit: (awardId: string, reason: RejectReason) => Promise<void>;
}>();
const open = defineModel<boolean>('open', { required: true });

const reason = ref<RejectReason>('NOT_ELIGIBLE');
const problem = ref('');
const loading = ref(false);

watch(open, (o) => {
  if (!o) return;
  reason.value = 'NOT_ELIGIBLE';
  problem.value = '';
});

const REASONS: RejectReason[] = ['NOT_ELIGIBLE', 'SUSPECTED_ABUSE', 'OTHER'];
const options = computed(() =>
  REASONS.map((r) => ({ value: r, label: t(`rewards.biz.reject.reason.${r}` as const) })),
);

async function send() {
  if (!props.award) return;
  problem.value = '';
  loading.value = true;
  try {
    await props.submit(props.award.id, reason.value);
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
    :title="t('rewards.biz.reject.title')"
    :description="t('rewards.biz.reject.body', { name: award?.name ?? '' })"
  >
    <form class="form" novalidate @submit.prevent="send">
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiSelect
        id="reject-reason"
        v-model="reason"
        :label="t('rewards.biz.reject.reason')"
        :options="options"
        required
      />
    </form>
    <template #footer>
      <UiButton variant="secondary" size="xs" @click="open = false">{{ t('cmp.close') }}</UiButton>
      <UiButton
        variant="danger"
        size="xs"
        :loading="loading"
        :loading-label="t('rewards.biz.pay.sending')"
        @click="send"
      >
        {{ t('rewards.biz.reject.submit') }}
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
</style>
