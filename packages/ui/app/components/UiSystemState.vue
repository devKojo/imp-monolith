<script setup lang="ts">
import { computed } from 'vue';
import { en } from '../i18n/en';
import { uiText, type TextParams } from '../composables/useUiText';
import { stateKey, systemStates, type SystemStateKind } from '../system-states';
import UiBanner from './UiBanner.vue';
import UiButton from './UiButton.vue';
import UiEmptyState from './UiEmptyState.vue';

/**
 * Renders any state from the spec section 11 matrix. Features pass a `kind` instead of writing
 * their own empty/error screens, so wording, structure and next actions stay identical everywhere.
 */
const props = defineProps<{
  kind: SystemStateKind;
  /** Values for placeholders in the copy, e.g. { time: '0:45' } or { status: 'Paused' }. */
  params?: TextParams;
}>();

const emit = defineEmits<{ action: [] }>();
const def = computed(() => systemStates[props.kind]);
const title = computed(() => uiText(stateKey(props.kind, 'title'), props.params));
const body = computed(() => uiText(stateKey(props.kind, 'body'), props.params));
const action = computed(() =>
  stateKey(props.kind, 'action') in en
    ? uiText(stateKey(props.kind, 'action'), props.params)
    : undefined,
);
</script>

<template>
  <UiBanner v-if="def.presentation === 'banner'" :tone="def.tone" :title="title">
    {{ body }}
    <template v-if="action || $slots.default" #actions>
      <slot
        ><UiButton variant="secondary" @click="emit('action')">{{ action }}</UiButton></slot
      >
    </template>
  </UiBanner>
  <UiEmptyState
    v-else
    :title="title"
    :description="body"
    :icon="def.icon"
    :heading-level="def.presentation === 'page' ? 1 : 2"
  >
    <slot
      ><UiButton v-if="action" @click="emit('action')">{{ action }}</UiButton></slot
    >
  </UiEmptyState>
</template>
