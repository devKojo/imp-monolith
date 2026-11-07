<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiCopyButton from './UiCopyButton.vue';
import UiIcon from './UiIcon.vue';

/**
 * Permission-aware treatment of an action (UI-DSH-03, spec 7.3). The slot receives `disabled`.
 *   never      user can never do this in their role  -> hidden entirely (server still returns 403)
 *   state      state prevents it                     -> disabled with a visible reason (+ resolve link)
 *   role       a colleague with another role can     -> disabled with "Ask a Campaign Manager" + copy link
 *   elevation  needs step-up or elevation            -> lock icon + label; activating opens the dialog
 * The client check is a usability aid only; the server's decision is final.
 */
const props = defineProps<{
  rule: 'allowed' | 'never' | 'state' | 'role' | 'elevation';
  /** Why it is blocked (state) or what the lock is for (elevation). */
  reason?: string;
  /** Link to hand to a colleague (role rule). */
  shareLink?: string;
  askLabel?: string;
}>();
const emit = defineEmits<{ activate: [] }>();
</script>

<template>
  <template v-if="props.rule === 'allowed'"><slot :disabled="false" /></template>
  <div v-else-if="props.rule !== 'never'" class="ui-gate">
    <slot :disabled="props.rule !== 'elevation'" />
    <p v-if="props.rule === 'state'" class="ui-gate__reason ui-text-body-s">
      {{ reason }}<slot name="resolve" />
    </p>
    <p v-else-if="props.rule === 'role'" class="ui-gate__reason ui-text-body-s">
      {{ askLabel ?? uiText('permission.askManager') }}
      <UiCopyButton v-if="shareLink" :value="shareLink" what="link" />
    </p>
    <button v-else type="button" class="ui-gate__lock ui-text-body-s" @click="emit('activate')">
      <UiIcon name="lock" :size="14" /> {{ reason ?? uiText('permission.locked') }}
    </button>
  </div>
</template>

<style scoped>
.ui-gate {
  display: inline-flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}
.ui-gate__reason {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.ui-gate__lock {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: 0;
  background: none;
  color: var(--ui-color-link);
  border: 0;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
</style>
