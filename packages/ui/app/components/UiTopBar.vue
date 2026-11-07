<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiButton from './UiButton.vue';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';

/**
 * Dashboard top bar (UI-DSH-01). The active business name is always visible; Help sits in the same
 * place on every page (UI-A11Y-13); the notification bell announces its unread count.
 */
defineProps<{
  businessName: string;
  roleLabel: string;
  userName: string;
  unread?: number;
  helpHref?: string;
  /** Show the menu button that opens the navigation drawer (below lg). */
  showMenu?: boolean;
  menuOpen?: boolean;
}>();

const emit = defineEmits<{ menu: []; notifications: []; userMenu: [] }>();
</script>

<template>
  <header class="ui-topbar">
    <UiButton
      v-if="showMenu"
      variant="tertiary"
      icon="menu"
      :aria-expanded="menuOpen"
      @click="emit('menu')"
    >
      <span class="ui-sr-only">{{
        menuOpen ? uiText('nav.closeMenu') : uiText('nav.openMenu')
      }}</span>
    </UiButton>
    <div class="ui-topbar__business">
      <slot name="switcher">
        <strong class="ui-topbar__name">{{ businessName }}</strong>
        <span class="ui-text-body-s ui-text-hint">({{ roleLabel }})</span>
      </slot>
    </div>
    <div class="ui-topbar__search"><slot name="search" /></div>
    <UiLink :to="helpHref ?? '/help'" class="ui-topbar__help"
      ><UiIcon name="help" :size="18" /> {{ uiText('common.help') }}</UiLink
    >
    <UiButton variant="tertiary" icon="bell" @click="emit('notifications')">
      <span class="ui-sr-only">{{ uiText('nav.notifications', { count: unread ?? 0 }) }}</span>
      <span v-if="unread" aria-hidden="true" class="ui-topbar__count ui-text-caption">{{
        unread
      }}</span>
    </UiButton>
    <UiButton variant="tertiary" icon="user" @click="emit('userMenu')">
      <span class="ui-topbar__user">{{ userName }}</span
      ><span class="ui-sr-only"> ({{ uiText('nav.userMenu') }})</span>
    </UiButton>
  </header>
</template>

<style scoped>
.ui-topbar {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-4);
  background: var(--ui-color-surface);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-topbar__business {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2);
  min-inline-size: 0;
}
.ui-topbar__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-topbar__search {
  flex: 1;
}
.ui-topbar__help {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
}
.ui-topbar__count {
  padding: 0 var(--ui-space-2);
  background: var(--ui-color-danger-text);
  color: var(--ui-color-action-primary-text);
  border-radius: var(--ui-radius-pill);
}
@media (max-width: 767px) {
  .ui-topbar__user {
    display: none;
  }
}
</style>
