<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '../../../i18n';
import { pageUrl } from '../publicPage';

/**
 * "Share link" for a running campaign: opens a dialog with the public address, a copy button and, where
 * the device offers one, the system share sheet. Used in the campaign library, the builder and on the
 * public page itself. The address is made in the browser from the site's own origin, so it is always
 * the one the visitor can open. The dialog can also be opened from elsewhere (a row's actions menu) with
 * `v-model:open` and `:trigger="false"`.
 */
const props = withDefaults(
  defineProps<{
    slug: string;
    title: string;
    variant?: 'primary' | 'secondary' | 'tertiary';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Shorter label, for a row of actions. */
    compact?: boolean;
    /** Show the "Share" button. Off when the dialog is opened by something else. */
    trigger?: boolean;
  }>(),
  { variant: 'tertiary', size: 'xs', compact: false, trigger: true },
);

const open = defineModel<boolean>('open', { default: false });
const url = ref('');
const canShare = ref(false);

// The address is made when the dialog opens, from the site's own origin.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    url.value = pageUrl(window.location.origin, props.slug);
    canShare.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  },
  { immediate: true },
);

async function nativeShare() {
  try {
    await navigator.share({
      title: t('cmp.share.shareTitle', { title: props.title }),
      url: url.value,
    });
  } catch {
    // The person closed the share sheet; nothing to report.
  }
}
</script>

<template>
  <span class="share">
    <UiButton v-if="trigger" :variant="variant" :size="size" icon="share" @click="open = true">
      {{ compact ? t('cmp.share') : t('pub.share') }}
      <span class="ui-sr-only"> {{ title }}</span>
    </UiButton>
    <UiDialog v-model:open="open" :title="t('cmp.share.title')" :description="t('cmp.share.body')">
      <div class="body">
        <UiTextInput :model-value="url" :label="t('cmp.share.link')" readonly icon="globe" />
        <div class="row">
          <UiCopyButton :value="url" :what="t('cmp.share.link')" />
          <UiButton v-if="canShare" variant="secondary" size="xs" icon="share" @click="nativeShare">
            {{ t('cmp.share.native') }}
          </UiButton>
        </div>
      </div>
      <template #footer>
        <UiButton variant="secondary" size="xs" @click="open = false">
          {{ t('cmp.close') }}
        </UiButton>
      </template>
    </UiDialog>
  </span>
</template>

<style scoped>
.share {
  display: inline-flex;
}
.body {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
</style>
