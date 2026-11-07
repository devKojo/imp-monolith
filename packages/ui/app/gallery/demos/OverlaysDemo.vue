<script setup lang="ts">
import { ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import UiConfirmDialog from '../../components/UiConfirmDialog.vue';
import UiConflictDialog from '../../components/UiConflictDialog.vue';
import UiDialog from '../../components/UiDialog.vue';
import UiStepUpDialog from '../../components/UiStepUpDialog.vue';
import GalleryBlock from '../GalleryBlock.vue';

const basic = ref(false);
const confirm = ref(false);
const destructive = ref(false);
const conflict = ref(false);
const stepUp = ref(false);
const last = ref('');
</script>

<template>
  <GalleryBlock name="UiDialog">
    <UiButton variant="secondary" @click="basic = true">Open dialog</UiButton>
    <UiDialog
      v-model:open="basic"
      title="Share campaign"
      description="Anyone with the link can view the public page."
    >
      <p>Dialogs trap focus, close with Escape and return focus here.</p>
      <template #footer><UiButton @click="basic = false">Close</UiButton></template>
    </UiDialog>
  </GalleryBlock>

  <GalleryBlock name="UiConfirmDialog">
    <div class="demo-row">
      <UiButton variant="secondary" @click="confirm = true">Confirm action</UiButton>
      <UiButton variant="danger" @click="destructive = true">Delete campaign</UiButton>
    </div>
    <UiConfirmDialog
      v-model:open="confirm"
      title="Publish campaign?"
      consequence="Black Friday Quiz goes live on 20 Nov at 09:00 GMT."
      confirm-label="Publish campaign"
      @confirm="((last = 'published'), (confirm = false))"
    />
    <UiConfirmDialog
      v-model:open="destructive"
      variant="destructive"
      title="Delete this campaign?"
      consequence="This deletes the campaign and its 12,480 entries. This cannot be undone."
      confirm-label="Delete campaign"
      typed-phrase="Black Friday Quiz"
      @confirm="((last = 'deleted'), (destructive = false))"
    />
    <p v-if="last" class="ui-text-body-s" role="status">Last result: {{ last }}</p>
  </GalleryBlock>

  <GalleryBlock name="UiConflictDialog">
    <UiButton variant="secondary" @click="conflict = true">Simulate a 412 conflict</UiButton>
    <UiConflictDialog
      :open="conflict"
      name="Alex Mensah"
      time="2 minutes ago"
      :their-changes="['Title', 'End date']"
      :your-changes="['Title', 'Prize description']"
      @review="conflict = false"
      @reload="conflict = false"
      @copy="conflict = false"
    />
  </GalleryBlock>

  <GalleryBlock name="UiStepUpDialog">
    <UiButton variant="secondary" @click="stepUp = true">Export participants</UiButton>
    <UiStepUpDialog
      v-model:open="stepUp"
      action="Export 12,480 participants as CSV"
      @confirm="stepUp = false"
    />
  </GalleryBlock>
</template>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}
</style>
