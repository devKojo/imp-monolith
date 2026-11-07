<script setup lang="ts">
import { ref } from 'vue';
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiLiveRegion from './UiLiveRegion.vue';

const props = defineProps<{
  /** Text placed on the clipboard. */
  value: string;
  /** What is being copied, for the accessible name: "Copy snapshot hash". */
  what: string;
}>();

const message = ref('');

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value);
    message.value = uiText('common.copied');
  } catch {
    message.value = ''; // clipboard blocked: the value is still visible next to the button
  }
  setTimeout(() => (message.value = ''), 2000);
}
</script>

<template>
  <span class="ui-copy">
    <UiButton variant="tertiary" icon="copy" @click="copy">
      {{ uiText('common.copy') }}<span class="ui-sr-only"> {{ what }}</span>
    </UiButton>
    <UiLiveRegion :message="message" />
  </span>
</template>
