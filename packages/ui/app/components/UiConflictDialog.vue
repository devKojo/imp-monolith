<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';

/**
 * Shown on a 412 response (UI-BLD-03). It names who changed the resource and when, and offers
 * three paths; none of them discards the user's input silently, and Escape is disabled so the
 * dialog cannot be dismissed without a choice.
 */
defineProps<{
  open: boolean;
  name: string;
  /** Relative time, e.g. "2 minutes ago". The absolute time should be available to the caller. */
  time: string;
  theirChanges: string[];
  yourChanges: string[];
}>();

const emit = defineEmits<{ review: []; reload: []; copy: [] }>();
</script>

<template>
  <UiDialog
    :open="open"
    :title="uiText('conflict.title', { name, time })"
    :description="uiText('conflict.body')"
    persistent
  >
    <dl class="ui-conflict">
      <div>
        <dt>{{ uiText('conflict.theirs') }}</dt>
        <dd>{{ theirChanges.join(', ') }}</dd>
      </div>
      <div>
        <dt>{{ uiText('conflict.yours') }}</dt>
        <dd>{{ yourChanges.join(', ') }}</dd>
      </div>
    </dl>
    <template #footer>
      <UiButton variant="secondary" @click="emit('review')">{{
        uiText('conflict.review')
      }}</UiButton>
      <UiButton variant="secondary" @click="emit('reload')">{{
        uiText('conflict.reload')
      }}</UiButton>
      <UiButton @click="emit('copy')">{{ uiText('conflict.copy') }}</UiButton>
    </template>
  </UiDialog>
</template>

<style scoped>
.ui-conflict {
  display: grid;
  gap: var(--ui-space-2);
  margin: 0;
}
dt {
  font-weight: 600;
}
dd {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
</style>
