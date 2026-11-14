<script setup lang="ts">
import { t } from '../../../i18n';

/** Login / Create switch at the top of the business card. Two real routes, so it works without scripts. */
defineProps<{ active: 'signin' | 'register' }>();
</script>

<template>
  <div class="switch" role="group" :aria-label="t('business.entry.switch')">
    <UiButton
      to="/business"
      block
      size="sm"
      :variant="active === 'signin' ? 'primary' : 'tertiary'"
      :aria-current="active === 'signin' ? 'page' : undefined"
    >
      {{ t('business.entry.tab.signin') }}
    </UiButton>
    <UiButton
      to="/business/register"
      block
      size="sm"
      :variant="active === 'register' ? 'primary' : 'tertiary'"
      :aria-current="active === 'register' ? 'page' : undefined"
    >
      {{ t('business.entry.tab.register') }}
    </UiButton>
  </div>
</template>

<style scoped>
.switch {
  display: flex;
  gap: var(--ui-space-1);
  inline-size: 100%;
  padding: var(--ui-space-1);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-lg);
}
.switch :deep(.ui-button) {
  flex: 1;
}
</style>
