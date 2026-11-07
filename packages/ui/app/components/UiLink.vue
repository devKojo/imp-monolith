<script setup lang="ts">
import { computed, resolveComponent } from 'vue';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';

const props = defineProps<{
  /** Internal route or external URL. */
  to: string;
  /** Opens in a new tab and shows an external marker with a text cue. */
  external?: boolean;
}>();

// Client-side navigation through NuxtLink when the app provides it; a plain anchor otherwise.
const nuxtLink = resolveComponent('NuxtLink');
const tag = computed(() => (props.external || typeof nuxtLink === 'string' ? 'a' : nuxtLink));
const attrs = computed(() =>
  props.external
    ? { href: props.to, target: '_blank', rel: 'noopener noreferrer' }
    : tag.value === 'a'
      ? { href: props.to }
      : { to: props.to },
);
</script>

<template>
  <component :is="tag" v-bind="attrs" class="ui-link">
    <slot />
    <template v-if="external">
      <UiIcon name="external" :size="14" />
      <span class="ui-sr-only"> {{ uiText('link.newTab') }}</span>
    </template>
  </component>
</template>

<style scoped>
.ui-link {
  color: var(--ui-color-link);
  text-decoration: underline;
  text-underline-offset: var(--ui-space-1);
  border-radius: var(--ui-radius-sm);
}
.ui-link:hover {
  text-decoration-thickness: var(--ui-focus-width);
}
</style>
