<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiCard from './UiCard.vue';
import UiLink from './UiLink.vue';

/**
 * Prize card for the public page and dashboard. Remaining stock is shown only if the tenant
 * enables it (`remaining` is omitted otherwise). Images need explicit dimensions to avoid layout
 * shift and alt text unless decorative (UI-FND-08).
 */
defineProps<{
  name: string;
  value?: string;
  quantity: number;
  remaining?: number;
  imageSrc?: string;
  /** Required with an image; use `decorative` only when the name already describes it. */
  imageAlt?: string;
  decorative?: boolean;
  rulesHref?: string;
}>();
</script>

<template>
  <UiCard as="article" :title="name">
    <img
      v-if="imageSrc"
      class="ui-reward__img"
      :src="imageSrc"
      :alt="decorative ? '' : (imageAlt ?? '')"
      width="320"
      height="180"
      loading="lazy"
    />
    <p v-if="value" class="ui-text-body-l ui-reward__value">{{ value }}</p>
    <p class="ui-text-body-s ui-text-hint">
      {{ uiText('reward.available', { n: quantity })
      }}<template v-if="remaining !== undefined">
        · {{ uiText('reward.remaining', { n: remaining }) }}</template
      >
    </p>
    <UiLink v-if="rulesHref" :to="rulesHref">{{ uiText('reward.rules') }}</UiLink>
  </UiCard>
</template>

<style scoped>
.ui-reward__img {
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--ui-radius-sm);
}
.ui-reward__value {
  margin: var(--ui-space-2) 0 0;
  font-weight: 700;
}
</style>
