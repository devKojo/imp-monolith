<script setup lang="ts">
import type { IconName } from '../icons';
import type { Tone } from '../status-vocabulary';
import UiBadge from './UiBadge.vue';
import UiIconTile from './UiIconTile.vue';

/**
 * A draw the participant has entered: what it is, when it draws and the ticket reference with its
 * confirmation state. The state is text plus an icon, never colour alone.
 */
defineProps<{
  icon: IconName;
  title: string;
  subtitle: string;
  /** "Draws in 2d". */
  when: string;
  ticketLabel: string;
  ticket: string;
  status: string;
  statusTone?: Tone;
  statusIcon?: IconName;
}>();
</script>

<template>
  <article class="ui-draw">
    <div class="ui-draw__head">
      <UiIconTile :icon="icon" />
      <div class="ui-draw__titles">
        <h3 class="ui-draw__title ui-text-h3">{{ title }}</h3>
        <p class="ui-draw__sub ui-text-body-s">{{ subtitle }}</p>
      </div>
      <UiBadge tone="info" shape="pill">{{ when }}</UiBadge>
    </div>
    <div class="ui-draw__foot ui-text-body-s">
      <span class="ui-draw__ticket"
        ><span class="ui-draw__ticket-label">{{ ticketLabel }}</span>
        <code class="ui-draw__code">{{ ticket }}</code></span
      >
      <UiBadge :tone="statusTone ?? 'success'" :icon="statusIcon ?? 'check-circle'" shape="pill">{{
        status
      }}</UiBadge>
    </div>
  </article>
</template>

<style scoped>
.ui-draw {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5) var(--ui-space-6);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-elevation-1);
}
.ui-draw__head {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-4);
}
.ui-draw__titles {
  flex: 1;
  min-inline-size: 0;
}
.ui-draw__title {
  margin: 0;
}
.ui-draw__sub {
  margin: var(--ui-space-1) 0 0;
  color: var(--ui-color-text-secondary);
}
.ui-draw__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding-block-start: var(--ui-space-4);
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-draw__ticket {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
}
.ui-draw__ticket-label {
  color: var(--ui-color-text-secondary);
}
.ui-draw__code {
  padding: var(--ui-space-1) var(--ui-space-2);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-sm);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--ui-font-caption-size);
  font-weight: 600;
}
</style>
