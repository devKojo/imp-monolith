<script setup lang="ts">
import { t } from '../../../i18n';

/**
 * Leading panel of the business entry page (business_entry design): badge, headline, lead, two
 * proof chips and a strip of what the portal is for. Static copy only: nothing here claims more than
 * the product does (ADR-F012), so the design's SLA badge and customer logos are not used.
 */
const strip = [
  { icon: 'rocket', key: 'campaigns' },
  { icon: 'users', key: 'team' },
  { icon: 'shield-check', key: 'trust' },
] as const;
</script>

<template>
  <section class="aside" aria-labelledby="business-aside-title">
    <div class="aside__top">
      <p class="aside__badge ui-text-label-sm">
        <span class="aside__dot" aria-hidden="true" />{{ t('business.entry.badge') }}
      </p>
      <h2 id="business-aside-title" class="aside__title">{{ t('business.entry.title') }}</h2>
      <p class="aside__lead ui-text-body-l">{{ t('business.entry.subtitle') }}</p>
      <ul class="aside__chips">
        <li class="aside__chip ui-text-label-sm">
          <UiIcon name="check-circle" :size="18" />{{ t('business.entry.chip.codes') }}
        </li>
        <li class="aside__chip ui-text-label-sm">
          <UiIcon name="shield-check" :size="18" />{{ t('business.entry.chip.draws') }}
        </li>
      </ul>
    </div>
    <div class="aside__bottom">
      <p class="aside__label ui-text-label-sm">{{ t('business.entry.strip') }}</p>
      <ul class="aside__strip">
        <li v-for="p in strip" :key="p.key" class="aside__item ui-text-h3">
          <UiIcon :name="p.icon" :size="20" />{{ t(`business.entry.${p.key}`) }}
        </li>
      </ul>
      <p class="aside__note ui-text-body-s">{{ t('business.entry.participantNote') }}</p>
    </div>
  </section>
</template>

<style scoped>
.aside {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--ui-space-8);
  block-size: 100%;
  min-block-size: 460px;
  padding: var(--ui-space-6);
  color: var(--ui-color-text-inverse);
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--ui-color-action-primary) 35%, var(--ui-color-surface-inverse)),
    var(--ui-color-surface-inverse)
  );
}
.aside p,
.aside h2,
.aside ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.aside__top {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  max-inline-size: 42rem;
}
.aside__badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid color-mix(in srgb, var(--ui-color-text-inverse) 30%, transparent);
  border-radius: var(--ui-radius-pill);
  background: color-mix(in srgb, var(--ui-color-text-inverse) 15%, transparent);
}
.aside__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-text-inverse-muted);
}
.aside__title {
  font-size: var(--ui-font-display-size);
  line-height: var(--ui-font-display-line);
  font-weight: var(--ui-font-display-weight);
  letter-spacing: var(--ui-font-display-tracking);
}
.aside__lead {
  color: var(--ui-color-text-inverse-muted);
}
.aside__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3);
}
.aside__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid color-mix(in srgb, var(--ui-color-text-inverse) 20%, transparent);
  border-radius: var(--ui-radius-md);
  background: color-mix(in srgb, var(--ui-color-text-inverse) 15%, transparent);
}
.aside__bottom {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding-block-start: var(--ui-space-6);
  border-block-start: 1px solid color-mix(in srgb, var(--ui-color-text-inverse) 20%, transparent);
}
.aside__label {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-color-text-inverse-muted);
}
.aside__strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3) var(--ui-space-6);
}
.aside__item {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.aside__note {
  color: var(--ui-color-text-inverse-muted);
}
@media (min-width: 640px) {
  .aside {
    padding: var(--ui-space-10);
  }
}
@media (min-width: 1024px) {
  .aside {
    min-block-size: 100vh;
    padding: var(--ui-space-12);
  }
}
</style>
