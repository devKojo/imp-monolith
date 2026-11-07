<script setup lang="ts">
/**
 * The feature card for the one thing a participant should do next (claim a reward). A deep-brand
 * gradient with white text; the action is a slot so the page decides what it does. Text sits on
 * the gradient at full contrast, secondary lines use a softened white that still passes 4.5:1.
 */
defineProps<{
  /** Small pill at the top-left ("Ready to claim"). */
  eyebrow: string;
  /** Top-right note ("Expires in 14 days"). */
  meta?: string;
  /** The headline value ("$100.00"). */
  amount: string;
  title: string;
  description?: string;
  /** Text beside the action ("Instant redemption code revealed immediately"). */
  note?: string;
}>();
</script>

<template>
  <section class="ui-claim" :aria-label="title">
    <div class="ui-claim__top">
      <span class="ui-claim__eyebrow ui-text-label-sm"
        ><span aria-hidden="true" class="ui-claim__dot" />{{ eyebrow }}</span
      >
      <span v-if="meta" class="ui-claim__meta ui-text-label">{{ meta }}</span>
    </div>
    <p class="ui-claim__amount">{{ amount }}</p>
    <h3 class="ui-claim__title">{{ title }}</h3>
    <p v-if="description" class="ui-claim__desc ui-text-body">{{ description }}</p>
    <div class="ui-claim__actions">
      <slot name="action" />
      <span v-if="note" class="ui-claim__note ui-text-label-sm">{{ note }}</span>
    </div>
  </section>
</template>

<style scoped>
.ui-claim {
  position: relative;
  display: flex;
  flex-direction: column;
  min-block-size: 360px;
  padding: var(--ui-space-8);
  overflow: hidden;
  border-radius: var(--ui-radius-xl);
  background: linear-gradient(
    135deg,
    var(--ui-color-action-primary-active),
    var(--ui-color-action-primary)
  );
  box-shadow: var(--ui-elevation-3);
  color: var(--ui-color-action-primary-text);
}
.ui-claim__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}
.ui-claim__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-1) var(--ui-space-3);
  border: 1px solid color-mix(in srgb, var(--ui-color-action-primary-text) 25%, transparent);
  border-radius: var(--ui-radius-pill);
  background: color-mix(in srgb, var(--ui-color-action-primary-text) 12%, transparent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ui-claim__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-success-bg);
}
.ui-claim__meta {
  opacity: 0.92;
}
.ui-claim__amount {
  margin: var(--ui-space-6) 0 0;
  font-size: var(--ui-font-hero-size);
  line-height: var(--ui-font-hero-line);
  font-weight: var(--ui-font-hero-weight);
  letter-spacing: var(--ui-font-hero-tracking);
}
.ui-claim__title {
  margin: var(--ui-space-2) 0 0;
  font-size: var(--ui-font-display-mobile-size);
  line-height: var(--ui-font-display-mobile-line);
  font-weight: var(--ui-font-display-mobile-weight);
  letter-spacing: var(--ui-font-display-mobile-tracking);
}
.ui-claim__desc {
  max-inline-size: 440px;
  margin: var(--ui-space-3) 0 0;
  opacity: 0.92;
}
.ui-claim__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-4);
  margin-block-start: auto;
  padding-block-start: var(--ui-space-8);
}
.ui-claim__note {
  max-inline-size: 240px;
  opacity: 0.92;
}
</style>
