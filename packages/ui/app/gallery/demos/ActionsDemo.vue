<script setup lang="ts">
import { ref } from 'vue';
import UiButton from '../../components/UiButton.vue';
import UiCopyButton from '../../components/UiCopyButton.vue';
import UiPermissionGate from '../../components/UiPermissionGate.vue';
import GalleryBlock from '../GalleryBlock.vue';

const loading = ref(false);
function fakeSave() {
  loading.value = true;
  setTimeout(() => (loading.value = false), 2000);
}
const activated = ref(false);
</script>

<template>
  <GalleryBlock name="UiButton">
    <div class="demo-row">
      <UiButton>Publish campaign</UiButton>
      <UiButton variant="secondary">Save draft</UiButton>
      <UiButton variant="tertiary">Cancel</UiButton>
      <UiButton variant="danger" icon="trash">Delete campaign</UiButton>
    </div>
    <div class="demo-row">
      <UiButton size="lg" icon="check">Enter now</UiButton>
      <UiButton :loading="loading" loading-label="Saving..." @click="fakeSave"
        >Save changes</UiButton
      >
      <UiButton disabled disabled-reason="Fix 2 issues before publishing."
        >Publish campaign</UiButton
      >
    </div>
    <p class="ui-text-body-s ui-text-hint">
      Labels are verb + object. The loading button keeps its width. Disabled buttons explain why in
      text.
    </p>

    <div class="demo-row">
      <UiButton to="/ui/components" icon-trailing="arrow-right">Link styled as a button</UiButton>
      <UiButton variant="secondary" to="/ui/states">Secondary link</UiButton>
      <UiButton icon-trailing="arrow-right">Create account</UiButton>
      <UiButton loading loading-label="Creating your account...">Create account</UiButton>
    </div>
    <p class="ui-text-body-s ui-text-hint">
      With <code>to</code> it renders an anchor with the same styling; loading shows a spinner and
      keeps the width.
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiCopyButton">
    <p class="ui-text-body-s">
      <code>9f2c4e1a</code> <UiCopyButton value="9f2c4e1a" what="snapshot hash" />
    </p>
  </GalleryBlock>

  <GalleryBlock name="UiPermissionGate">
    <div class="demo-grid">
      <div>
        <p class="ui-text-caption">Allowed</p>
        <UiPermissionGate v-slot="{ disabled }" rule="allowed"
          ><UiButton :disabled="disabled">Publish campaign</UiButton></UiPermissionGate
        >
      </div>
      <div>
        <p class="ui-text-caption">Never (hidden)</p>
        <UiPermissionGate v-slot="{ disabled }" rule="never"
          ><UiButton :disabled="disabled">Edit campaign</UiButton></UiPermissionGate
        >
        <span class="ui-text-body-s ui-text-hint">Nothing renders for an Analyst.</span>
      </div>
      <div>
        <p class="ui-text-caption">State prevents it</p>
        <UiPermissionGate v-slot="{ disabled }" rule="state" reason="Add a prize description first."
          ><UiButton :disabled="disabled">Publish campaign</UiButton></UiPermissionGate
        >
      </div>
      <div>
        <p class="ui-text-caption">Needs another role</p>
        <UiPermissionGate
          v-slot="{ disabled }"
          rule="role"
          share-link="https://app.example/campaigns/123"
          ><UiButton :disabled="disabled">Publish campaign</UiButton></UiPermissionGate
        >
      </div>
      <div>
        <p class="ui-text-caption">Needs step-up</p>
        <UiPermissionGate
          v-slot="{ disabled }"
          rule="elevation"
          reason="Export participants (step-up)"
          @activate="activated = true"
          ><UiButton :disabled="disabled" variant="secondary">Export</UiButton></UiPermissionGate
        >
        <span v-if="activated" class="ui-text-body-s">Step-up dialog would open here.</span>
      </div>
    </div>
  </GalleryBlock>
</template>

<style scoped>
.demo-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--ui-space-3);
}
.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--ui-space-12) * 5), 1fr));
  gap: var(--ui-space-4);
}
p {
  margin: 0 0 var(--ui-space-1);
}
</style>
