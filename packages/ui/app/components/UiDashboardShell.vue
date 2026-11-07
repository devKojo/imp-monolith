<script setup lang="ts">
import { ref } from 'vue';
import UiSidebarNav, { type NavItem } from './UiSidebarNav.vue';
import UiSkipLink from './UiSkipLink.vue';
import UiTopBar from './UiTopBar.vue';

/**
 * Business dashboard / admin shell (UI-DSH-01): left navigation at lg and up, a drawer below lg,
 * top bar, breadcrumbs slot, banner slot (elevation, suspended, usage) above content, and one
 * <main id="main"> landmark. Sets the dashboard control size (32 px) for everything inside.
 */
defineProps<{
  businessName: string;
  roleLabel: string;
  userName: string;
  nav: NavItem[];
  unread?: number;
  helpHref?: string;
}>();

const drawer = ref(false);
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') drawer.value = false;
}
</script>

<template>
  <div class="ui-shell" @keydown="onKey">
    <UiSkipLink />
    <div class="ui-shell__banners"><slot name="banner" /></div>
    <UiTopBar
      show-menu
      :menu-open="drawer"
      :business-name="businessName"
      :role-label="roleLabel"
      :user-name="userName"
      :unread="unread"
      :help-href="helpHref"
      @menu="drawer = !drawer"
    >
      <template v-if="$slots.switcher" #switcher><slot name="switcher" /></template>
      <template v-if="$slots.search" #search><slot name="search" /></template>
    </UiTopBar>
    <div class="ui-shell__body">
      <aside class="ui-shell__side" :data-open="drawer">
        <UiSidebarNav :items="nav" />
      </aside>
      <div class="ui-shell__content">
        <slot name="breadcrumbs" />
        <main id="main" tabindex="-1" class="ui-shell__main"><slot /></main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-shell {
  --ui-control-target: var(--ui-target-dashboard);
  min-block-size: 100vh;
  background: var(--ui-color-surface-subtle);
}
.ui-shell__banners {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}
.ui-shell__body {
  display: flex;
}
.ui-shell__side {
  display: none;
  flex: none;
  inline-size: calc(var(--ui-space-12) * 5);
  padding: var(--ui-space-4);
  background: var(--ui-color-surface);
  border-inline-end: 1px solid var(--ui-color-border);
}
.ui-shell__side[data-open='true'] {
  display: block;
}
.ui-shell__content {
  flex: 1;
  min-inline-size: 0;
  max-inline-size: var(--ui-layout-content-max);
  padding: var(--ui-space-4);
}
.ui-shell__main:focus {
  outline: none;
}
@media (min-width: 1024px) {
  .ui-shell__side {
    display: block;
  }
}
@media (max-width: 1023px) {
  .ui-shell__side[data-open='true'] {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 50;
    box-shadow: var(--ui-elevation-3);
  }
}
</style>
