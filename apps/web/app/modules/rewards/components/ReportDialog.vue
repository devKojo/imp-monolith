<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import { toApiError } from '../../auth/errors';
import { reportErrorKey } from '../errors';
import type { ReportInput, ReportReason } from '../types';

/**
 * A winner reporting that a reward looks like a scam. It goes to the platform; the business cannot see that
 * it was sent or by whom. Nothing typed is lost if sending fails.
 */
const props = defineProps<{
  submit: (input: ReportInput) => Promise<void>;
}>();
const open = defineModel<boolean>('open', { required: true });

const REASONS: ReportReason[] = ['ASKED_TO_PAY', 'SUSPICIOUS_CONTACT', 'NOT_RECEIVED', 'OTHER'];
const reason = ref<ReportReason>('ASKED_TO_PAY');
const details = ref('');
const problem = ref('');
const loading = ref(false);

watch(open, (o) => {
  if (!o) return;
  reason.value = 'ASKED_TO_PAY';
  details.value = '';
  problem.value = '';
});

const options = computed(() =>
  REASONS.map((r) => ({ value: r, label: t(`rewards.report.reason.${r}` as const) })),
);

async function send() {
  problem.value = '';
  loading.value = true;
  try {
    const note = details.value.trim();
    await props.submit({ reason: reason.value, ...(note ? { details: note } : {}) });
    open.value = false;
  } catch (e) {
    problem.value = t(reportErrorKey(toApiError(e)));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="t('rewards.report.title')"
    :description="t('rewards.report.body')"
  >
    <form class="form" novalidate @submit.prevent="send">
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiSelect
        id="report-reason"
        v-model="reason"
        :label="t('rewards.report.reason')"
        :options="options"
        required
      />
      <UiTextInput
        id="report-details"
        v-model="details"
        :label="t('rewards.report.details')"
        :maxlength="1000"
        multiline
        :rows="4"
        autocomplete="off"
      />
    </form>
    <template #footer>
      <UiButton variant="secondary" size="xs" @click="open = false">{{ t('cmp.close') }}</UiButton>
      <UiButton
        size="xs"
        :loading="loading"
        :loading-label="t('rewards.report.sending')"
        @click="send"
      >
        {{ t('rewards.report.submit') }}
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
