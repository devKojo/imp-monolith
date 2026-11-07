<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiCard from './UiCard.vue';
import UiIcon from './UiIcon.vue';

/**
 * Wraps the CAPTCHA provider widget (UI-PUB-11). Mount it only on risk escalation; it explains
 * why, offers a non-puzzle alternative reachable by keyboard (WCAG 3.3.8), and never clears the
 * entered form data on failure (the form state lives outside this component).
 */
defineProps<{ state?: 'challenge' | 'failed' }>();
const emit = defineEmits<{ alternative: [] }>();
</script>

<template>
  <UiCard tone="subtle" :title="uiText('captcha.title')" :heading-level="3">
    <p class="ui-text-body">{{ uiText('captcha.why') }}</p>
    <p v-if="state === 'failed'" class="ui-captcha__error ui-text-body-s">
      <UiIcon name="alert-circle" :size="16" /> {{ uiText('captcha.failed') }}
    </p>
    <div class="ui-captcha__widget"><slot /></div>
    <UiButton variant="secondary" @click="emit('alternative')">{{
      uiText('captcha.alternative')
    }}</UiButton>
  </UiCard>
</template>

<style scoped>
.ui-captcha__widget {
  margin-block: var(--ui-space-3);
}
.ui-captcha__error {
  display: flex;
  gap: var(--ui-space-1);
  color: var(--ui-color-danger-text);
}
</style>
