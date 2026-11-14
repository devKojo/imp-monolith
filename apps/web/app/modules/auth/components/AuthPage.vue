<script setup lang="ts">
import AuthAside from './AuthAside.vue';

/**
 * The one frame for sign-in, sign-up and account recovery: the full-bleed split layout with the
 * brand panel on the leading side and a flat form on the trailing side.
 */
defineProps<{
  title: string;
  subtitle?: string | undefined;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  variant?: 'business' | 'participant' | 'general';
}>();
</script>

<template>
  <UiAuthShell layout="split" :title="title" :subtitle="subtitle" :breadcrumbs="breadcrumbs">
    <template #aside><AuthAside :variant="variant ?? 'general'" /></template>
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    <template v-if="$slots.below" #below><slot name="below" /></template>
  </UiAuthShell>
</template>
