<script setup lang="ts">
import { t } from '../../../i18n';

/**
 * Supporting panel beside the business sign-in and registration cards (business entry design).
 * Static copy only: nothing here claims more than the product does (ADR-F012).
 */
const points = [
  { icon: 'rocket', key: 'campaigns' },
  { icon: 'users', key: 'team' },
  { icon: 'shield-check', key: 'trust' },
] as const;
</script>

<template>
  <section class="aside" aria-labelledby="business-aside-title">
    <p class="aside__badge ui-text-label-sm">{{ t('business.entry.badge') }}</p>
    <h2 id="business-aside-title" class="aside__title ui-text-h1">
      {{ t('business.entry.title') }}
    </h2>
    <p class="ui-text-body-l aside__lead">{{ t('business.entry.subtitle') }}</p>
    <ul class="aside__points">
      <li v-for="p in points" :key="p.key" class="aside__point">
        <UiIcon :name="p.icon" :size="22" />
        <div>
          <strong class="ui-text-label-base">{{ t(`business.entry.${p.key}.title`) }}</strong>
          <p class="ui-text-body-s">{{ t(`business.entry.${p.key}.body`) }}</p>
        </div>
      </li>
    </ul>
    <p class="ui-text-caption">{{ t('business.entry.participantNote') }}</p>
  </section>
</template>

<style scoped>
.aside {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
  padding: var(--ui-space-10);
  color: var(--ui-color-action-primary-text);
  background: var(--ui-color-action-primary);
  border-radius: var(--ui-radius-lg);
}
.aside p,
.aside h2 {
  margin: 0;
}
.aside__badge {
  align-self: flex-start;
  padding: var(--ui-space-1) var(--ui-space-3);
  border: 1px solid currentcolor;
  border-radius: var(--ui-radius-pill);
}
.aside__points {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.aside__point {
  display: flex;
  gap: var(--ui-space-3);
  align-items: flex-start;
}
</style>
