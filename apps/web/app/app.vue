<script setup lang="ts">
// The main text font is needed for first paint: fetch it early, with the page, instead of after the CSS.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';

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
