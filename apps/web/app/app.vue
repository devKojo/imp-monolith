<script setup lang="ts">
// The main text font is needed for first paint: fetch it early, with the page, instead of after the CSS.
import { provideHomeRoute } from '@imp/ui/app/composables/useHomeRoute';
import { useHomeLink } from './modules/auth/composables/useHomeLink';
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

// Error and dead-end screens send a signed-in person to their own dashboard (read by UiSystemState).
provideHomeRoute(useHomeLink());

useHead({
  link: [
    { rel: 'preload', as: 'font', type: 'font/woff2', href: interLatin, crossorigin: 'anonymous' },
  ],
});
</script>

<template>
  <UiToaster>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UiToaster>
</template>
