<script setup lang="ts">
/**
 * Status messages (saved, submitted, errors) are announced through aria-live regions (UI-A11Y-05):
 * polite by default, assertive only for blocking errors. The region element must exist before its
 * text changes, so keep this component mounted and change `message`.
 */
withDefaults(
  defineProps<{
    message?: string;
    politeness?: 'polite' | 'assertive';
    /** Show the text visually as well as announcing it. */
    visible?: boolean;
  }>(),
  { message: '', politeness: 'polite', visible: false },
);
</script>

<template>
  <div
    :role="politeness === 'assertive' ? 'alert' : 'status'"
    :aria-live="politeness"
    aria-atomic="true"
    :class="visible ? 'ui-live' : 'ui-sr-only'"
  >
    {{ message }}
  </div>
</template>
