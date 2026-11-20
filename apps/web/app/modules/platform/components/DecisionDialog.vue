<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '../../../i18n';
import { toApiError } from '../../auth/errors';
import { decisionProblem } from '../logic';
import type { Decision, ReviewItem } from '../types';

/**
 * A platform decision about one award. It changes what a winner is owed, so the reviewer re-enters their
 * password and may leave a note that is kept with the decision (never shown to the winner or the business).
 * What the server refuses is shown here and nothing typed is lost.
 */
const props = defineProps<{
  item: ReviewItem | null;
  decision: Decision;
  submit: (
    awardId: string,
    input: { decision: Decision; note: string; password: string },
  ) => Promise<void>;
}>();
const open = defineModel<boolean>('open', { required: true });

const note = ref('');
const password = ref('');
const problem = ref('');
const loading = ref(false);

watch(open, (o) => {
  if (!o) return;
  note.value = '';
  password.value = '';
  problem.value = '';
});

async function send() {
  if (!props.item) return;
  problem.value = '';
  loading.value = true;
  try {
    await props.submit(props.item.awardId, {
      decision: props.decision,
      note: note.value,
      password: password.value,
    });
    open.value = false;
  } catch (e) {
    problem.value = t(`platform.error.${decisionProblem(toApiError(e))}` as const);
  } finally {
    password.value = '';
    loading.value = false;
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="t(`platform.decision.${decision}.title` as const)"
    :description="
      t(`platform.decision.${decision}.body` as const, {
        winner: item?.winnerName ?? '',
        business: item?.businessName ?? '',
      })
    "
  >
    <form class="form" novalidate @submit.prevent="send">
      <UiBanner v-if="problem" tone="error" role="alert">{{ problem }}</UiBanner>
      <UiTextInput
        id="decision-note"
        v-model="note"
        :label="t('platform.decision.note')"
        :hint="t('platform.decision.note.hint')"
        :maxlength="500"
        multiline
        :rows="3"
        autocomplete="off"
      />
      <UiPasswordField
        id="decision-password"
        v-model="password"
        autocomplete="current-password"
        :label="t('platform.decision.password')"
        required
      />
    </form>
    <template #footer>
      <UiButton variant="secondary" size="xs" @click="open = false">{{ t('cmp.close') }}</UiButton>
      <UiButton
        :variant="decision === 'release' ? 'primary' : 'danger'"
        size="xs"
        :loading="loading"
        :loading-label="t('platform.decision.sending')"
        @click="send"
      >
        {{ t(`platform.decision.${decision}.submit` as const) }}
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
