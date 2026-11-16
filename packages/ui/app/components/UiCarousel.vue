<script setup lang="ts">
import { computed, useId } from 'vue';
import { uiText } from '../composables/useUiText';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';

/**
 * A section with a title and one slide visible at a time. The page owns the slides: put the current
 * one in the default slot (it receives `index`) and keep the position with `v-model`. Controls are
 * previous/next buttons plus one dot per slide; every control is a real button with a label, the
 * current dot is marked with `aria-current`, and a change is announced politely. Nothing moves by
 * itself, so there is no motion to pause.
 */
const props = defineProps<{
  title: string;
  subtitle?: string;
  /** Small pill beside the title ("3 active"). */
  badge?: string;
  /** Number of slides. */
  count: number;
}>();

const index = defineModel<number>({ default: 0 });
const titleId = useId();
const current = computed(() => Math.min(Math.max(index.value, 0), Math.max(props.count - 1, 0)));

const go = (to: number) => {
  if (props.count < 1) return;
  // Wrap around so both arrows always do something.
  index.value = (to + props.count) % props.count;
};
const dotLabel = (n: number) => uiText('carousel.goTo', { n, total: props.count });
</script>

<template>
  <section class="ui-carousel" :aria-labelledby="titleId">
    <div class="ui-carousel__head">
      <div>
        <div class="ui-carousel__titles">
          <h2 :id="titleId" class="ui-text-h2">{{ title }}</h2>
          <UiBadge v-if="badge" tone="info" shape="pill">{{ badge }}</UiBadge>
        </div>
        <p v-if="subtitle" class="ui-carousel__sub ui-text-body-s">{{ subtitle }}</p>
      </div>
      <div v-if="count > 1" class="ui-carousel__controls">
        <div class="ui-carousel__dots">
          <button
            v-for="n in count"
            :key="n"
            type="button"
            class="ui-carousel__dot"
            :aria-label="dotLabel(n)"
            :aria-current="n - 1 === current ? 'true' : undefined"
            @click="go(n - 1)"
          />
        </div>
        <UiButton
          variant="secondary"
          size="sm"
          icon="chevron-left"
          :aria-label="uiText('carousel.previous')"
          @click="go(current - 1)"
        />
        <UiButton
          variant="secondary"
          size="sm"
          icon="chevron-right"
          :aria-label="uiText('carousel.next')"
          @click="go(current + 1)"
        />
      </div>
    </div>
    <div class="ui-carousel__body" aria-live="polite" aria-atomic="true">
      <slot :index="current" />
    </div>
  </section>
</template>

<style scoped>
.ui-carousel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-space-3);
  margin-block-end: var(--ui-space-4);
}
.ui-carousel__titles {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}
.ui-carousel__titles h2,
.ui-carousel__sub {
  margin: 0;
}
.ui-carousel__sub {
  color: var(--ui-color-text-secondary);
}
.ui-carousel__controls {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.ui-carousel__dots {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-inline-end: var(--ui-space-2);
}
.ui-carousel__dot {
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-pill);
  background: var(--ui-color-border);
  cursor: pointer;
  transition: inline-size 0.2s;
}
.ui-carousel__dot[aria-current='true'] {
  inline-size: var(--ui-space-6);
  background: var(--ui-color-action-primary);
}
.ui-carousel__dot:focus-visible {
  outline: 2px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .ui-carousel__dot {
    transition: none;
  }
}
</style>
