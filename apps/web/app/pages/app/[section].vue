<script setup lang="ts">
import { t } from '../../i18n';
import BusinessShell from '../../modules/business/components/BusinessShell.vue';

/** Console sections that are built in later releases: one honest "coming soon" page. */
definePageMeta({ middleware: 'auth', portal: 'business' });
useHead({ title: t('console.soon.title') });

const route = useRoute();
</script>

<template>
  <BusinessShell :current="String(route.params.section)">
    <UiEmptyState :title="t('console.soon.title')" :description="t('console.soon.body')">
      <UiButton to="/app" variant="secondary" size="xs">{{ t('console.soon.back') }}</UiButton>
    </UiEmptyState>
  </BusinessShell>
</template>
