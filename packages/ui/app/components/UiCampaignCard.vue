<script setup lang="ts">
import { useId } from 'vue';
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import UiCard from './UiCard.vue';
import UiIcon from './UiIcon.vue';

/**
 * A campaign in a discovery list (public, edge-cached): media, experience type, time left, who runs
 * it, what it is, the prize and one call to action. There is one link, the button: the whole card
 * is not a second link, so keyboard and screen-reader users hear each campaign once. The relative
 * "time left" always has the absolute end time available on the `<time>` element (UI-CPY-04).
 */
withDefaults(
  defineProps<{
    title: string;
    summary: string;
    businessName: string;
    /** Experience type, e.g. "Quiz". */
    typeLabel: string;
    typeIcon?: IconName;
    to: string;
    /** Relative text such as "2 days left". */
    timeLeft?: string;
    endsAtIso?: string;
    /** Absolute end time with zone, e.g. "30 Nov, 23:59 GMT". */
    endsAtLabel?: string;
    prizeLabel?: string;
    prizeValue?: string;
    imageSrc?: string;
    /** Alt text for the image; the image is decorative if omitted. */
    imageAlt?: string;
    ctaLabel?: string;
  }>(),
  { typeIcon: 'gift' },
);

const titleId = useId();
</script>

<template>
  <UiCard as="article" flush class="ui-campaign" :aria-labelledby="titleId">
    <div class="ui-campaign__media">
      <img
        v-if="imageSrc"
        class="ui-campaign__img"
        :src="imageSrc"
        :alt="imageAlt ?? ''"
        width="640"
        height="360"
        loading="lazy"
      />
      <div v-else class="ui-campaign__placeholder" aria-hidden="true">
        <UiIcon :name="typeIcon" :size="40" />
      </div>
      <div class="ui-campaign__tags">
        <UiBadge :icon="typeIcon">{{ typeLabel }}</UiBadge>
        <time v-if="timeLeft" :datetime="endsAtIso" :title="endsAtLabel">
          <UiBadge tone="info" icon="clock" shape="pill">{{ timeLeft }}</UiBadge>
          <span v-if="endsAtLabel" class="ui-sr-only">
            ({{ uiText('campaign.endsOn', { when: endsAtLabel }) }})</span
          >
        </time>
      </div>
    </div>
    <div class="ui-campaign__body">
      <p class="ui-campaign__by ui-text-label-sm">
        {{ uiText('campaign.by', { name: businessName }) }}
      </p>
      <h3 :id="titleId" class="ui-campaign__title ui-text-h3">{{ title }}</h3>
      <p class="ui-campaign__summary ui-text-body-s">{{ summary }}</p>
      <div class="ui-campaign__foot">
        <div v-if="prizeValue" class="ui-campaign__prize">
          <span v-if="prizeLabel" class="ui-text-label-sm ui-text-hint">{{ prizeLabel }}</span>
          <span class="ui-campaign__value ui-text-h3">{{ prizeValue }}</span>
        </div>
        <UiButton :to="to">
          {{ ctaLabel ?? uiText('campaign.viewCta') }}<span class="ui-sr-only">: {{ title }}</span>
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.ui-campaign {
  display: flex;
  flex-direction: column;
  block-size: 100%;
}
.ui-campaign__media {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--ui-color-selected-bg);
}
.ui-campaign__img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.ui-campaign__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 100%;
  color: var(--ui-color-selected-text);
}
.ui-campaign__tags {
  position: absolute;
  inset-block-start: var(--ui-space-2);
  inset-inline: var(--ui-space-2);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-2);
}
.ui-campaign__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding: var(--ui-space-4);
}
.ui-campaign__by {
  margin: 0;
  color: var(--ui-color-text-secondary);
}
.ui-campaign__title {
  margin: 0;
}
.ui-campaign__summary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
.ui-campaign__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block-start: auto;
  padding-block-start: var(--ui-space-3);
}
.ui-campaign__prize {
  display: flex;
  flex-direction: column;
}
.ui-campaign__value {
  color: var(--ui-color-selected-text);
}
</style>
