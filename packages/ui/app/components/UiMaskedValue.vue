<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiLiveRegion from './UiLiveRegion.vue';

/**
 * Masked PII (UI-DSH-07, spec 7.4). Shows the mask by default. When `reveal` is provided (the user
 * holds participants:read_pii) a per-record Reveal button fetches the value, shows the audit
 * notice, and re-masks automatically after `autoMaskMs` (30 s). The audit write is the caller's
 * `reveal` function's job and must happen server-side.
 */
const props = withDefaults(
  defineProps<{
    masked: string;
    /** What this is, for the accessible name: "phone number". */
    what: string;
    /** Absent when the user may not reveal: the control is then hidden, not disabled. */
    reveal?: () => Promise<string>;
    autoMaskMs?: number;
  }>(),
  { autoMaskMs: 30_000 },
);

const emit = defineEmits<{ revealed: []; masked: [] }>();
const value = ref<string | null>(null);
const loading = ref(false);
const announce = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

async function doReveal() {
  if (!props.reveal) return;
  loading.value = true;
  try {
    value.value = await props.reveal();
    emit('revealed');
    timer = setTimeout(hide, props.autoMaskMs);
  } finally {
    loading.value = false;
  }
}
function hide() {
  clearTimeout(timer);
  value.value = null;
  announce.value = uiText('mask.hidden', { what: props.what });
  emit('masked');
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <span class="ui-masked">
    <span class="ui-masked__value" :data-revealed="value !== null">{{ value ?? masked }}</span>
    <UiButton
      v-if="reveal && value === null"
      variant="tertiary"
      :loading="loading"
      @click="doReveal"
    >
      {{ uiText('mask.reveal') }}<span class="ui-sr-only"> {{ what }}</span>
    </UiButton>
    <template v-if="value !== null">
      <UiButton variant="tertiary" @click="hide"
        >{{ uiText('mask.hide') }}<span class="ui-sr-only"> {{ what }}</span></UiButton
      >
      <span class="ui-text-body-s ui-text-hint">{{ uiText('mask.notice') }}</span>
    </template>
    <UiLiveRegion :message="announce" />
  </span>
</template>

<style scoped>
.ui-masked {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
}
.ui-masked__value {
  font-variant-numeric: tabular-nums;
}
</style>
