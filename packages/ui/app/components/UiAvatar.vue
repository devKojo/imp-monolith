<script setup lang="ts">
import { computed } from 'vue';
import { uiText } from '../composables/useUiText';

/**
 * Initials in a filled circle, with an optional "verified" dot. Initials only: no photos, so there
 * is nothing to moderate or load. The name is the accessible text; the circle is decorative.
 */
const props = withDefaults(
  defineProps<{ name: string; size?: 'sm' | 'md'; verified?: boolean; tone?: 'brand' | 'soft' }>(),
  { size: 'md', tone: 'brand' },
);

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
});
</script>

<template>
  <span class="ui-avatar" :data-size="size" :data-tone="tone">
    <span aria-hidden="true" class="ui-avatar__initials">{{ initials }}</span>
    <span
      v-if="verified"
      class="ui-avatar__dot"
      role="img"
      :aria-label="uiText('avatar.verified')"
    />
    <span class="ui-sr-only">{{ name }}</span>
  </span>
</template>

<style scoped>
.ui-avatar {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: var(--ui-space-10);
  block-size: var(--ui-space-10);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-action-primary);
  color: var(--ui-color-action-primary-text);
  font-size: var(--ui-font-body-s-size);
  font-weight: 700;
}
.ui-avatar[data-size='sm'] {
  inline-size: var(--ui-space-8);
  block-size: var(--ui-space-8);
  font-size: var(--ui-font-caption-size);
}
.ui-avatar[data-tone='soft'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
}
.ui-avatar__dot {
  position: absolute;
  inset-block-end: 0;
  inset-inline-end: 0;
  inline-size: var(--ui-space-3);
  block-size: var(--ui-space-3);
  border: 2px solid var(--ui-color-surface);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-success-text);
}
</style>
