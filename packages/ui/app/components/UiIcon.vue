<script setup lang="ts">
import { computed } from 'vue';
import { icons, type IconName } from '../icons';

const props = withDefaults(
  defineProps<{
    name: IconName;
    /** Accessible name. Omit when the icon sits beside a text label (decorative). */
    label?: string;
    size?: number;
  }>(),
  { size: 20 },
);

const def = computed(() => icons[props.name]);
const isFilled = computed(() => 'fill' in def.value && def.value.fill === true);
</script>

<template>
  <svg
    class="ui-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="isFilled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <path v-for="d in def.d" :key="d" :d="d" />
  </svg>
</template>

<style scoped>
.ui-icon {
  flex: none;
  vertical-align: middle;
}
</style>
