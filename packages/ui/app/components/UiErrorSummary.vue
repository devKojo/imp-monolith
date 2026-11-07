<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';

/**
 * Validation error summary (spec section 11, 422): focus moves here when errors appear, each item
 * links to its field, and the inline messages stay next to the fields. Input is never cleared.
 */
const props = defineProps<{ errors: Array<{ fieldId: string; message: string }> }>();

const root = ref<HTMLElement | null>(null);
watch(
  () => props.errors.length,
  async (now, before) => {
    if (now > 0 && now !== before) {
      await nextTick();
      root.value?.focus();
    }
  },
);

function goTo(fieldId: string, e: Event) {
  e.preventDefault();
  document.getElementById(fieldId)?.focus();
}
</script>

<template>
  <div v-if="errors.length" ref="root" class="ui-error-summary" role="alert" tabindex="-1">
    <h2 class="ui-error-summary__title ui-text-h3">
      <UiIcon name="alert-circle" :size="20" /> {{ uiText('form.errorSummary.title') }}
    </h2>
    <ul>
      <li v-for="e in errors" :key="e.fieldId">
        <a :href="`#${e.fieldId}`" @click="goTo(e.fieldId, $event)">{{ e.message }}</a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ui-error-summary {
  padding: var(--ui-space-4);
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-text);
  border: 1px solid var(--ui-color-danger-text);
  border-radius: var(--ui-radius-md);
}
.ui-error-summary__title {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin: 0 0 var(--ui-space-2);
}
ul {
  margin: 0;
  padding-inline-start: var(--ui-space-6);
}
a {
  color: inherit;
}
</style>
