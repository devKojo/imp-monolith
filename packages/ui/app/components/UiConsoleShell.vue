<script setup lang="ts">
import { ref } from 'vue';
import { uiText } from '../composables/useUiText';
import UiAvatar from './UiAvatar.vue';
import UiButton from './UiButton.vue';
import UiSidebarNav, { type NavItem } from './UiSidebarNav.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Business console frame: a fixed-width sidebar (brand, navigation, account card) and a slim header
 * (search, actions) above one <main> landmark. Below lg the sidebar becomes a drawer. It sets the
 * dashboard control size (32 px) for everything inside. Compare UiDashboardShell, which follows the
 * spec's top-bar wireframe; this one follows the console design reference (ADR-F013).
 */
defineProps<{
  brandName: string;
  /** Small tag after the brand ("v2.4"); optional. */
  brandTag?: string;
  nav: NavItem[];
  userName: string;
  userRole: string;
  navLabel?: string;
}>();

const emit = defineEmits<{ account: [] }>();
const drawer = ref(false);
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') drawer.value = false;
}
</script>

<template>
  <div class="ui-console" @keydown="onKey">
    <UiSkipLink />
    <aside class="ui-console__side" :data-open="drawer">
      <div class="ui-console__brand">
        <slot name="brand">
          <strong class="ui-text-h3">{{ brandName }}</strong>
        </slot>
        <span v-if="brandTag" class="ui-console__tag ui-text-caption">{{ brandTag }}</span>
      </div>
      <UiSidebarNav :items="nav" :label="navLabel" />
      <div class="ui-console__account">
        <UiButton variant="tertiary" block class="ui-console__account-btn" @click="emit('account')">
          <span class="ui-console__account-inner">
            <UiAvatar :name="userName" size="sm" tone="soft" />
            <span class="ui-console__who">
              <span class="ui-console__name ui-text-label">{{ userName }}</span>
              <span class="ui-console__role ui-text-caption">{{ userRole }}</span>
            </span>
          </span>
          <span class="ui-sr-only"> ({{ uiText('nav.userMenu') }})</span>
        </UiButton>
      </div>
    </aside>
    <div class="ui-console__frame">
      <header class="ui-console__header">
        <span class="ui-console__menu">
          <UiButton
            variant="tertiary"
            icon="menu"
            :aria-expanded="drawer"
            @click="drawer = !drawer"
          >
            <span class="ui-sr-only">{{
              drawer ? uiText('nav.closeMenu') : uiText('nav.openMenu')
            }}</span>
          </UiButton>
        </span>
        <div class="ui-console__search"><slot name="search" /></div>
        <div class="ui-console__actions"><slot name="actions" /></div>
      </header>
      <div class="ui-console__banners"><slot name="banner" /></div>
      <main id="main" tabindex="-1" class="ui-console__main"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
.ui-console {
  --ui-control-target: var(--ui-target-dashboard);
  display: flex;
  min-block-size: 100vh;
  background: var(--ui-color-surface-page);
}
.ui-console__side {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  display: none;
  flex: none;
  flex-direction: column;
  gap: var(--ui-space-4);
  inline-size: 240px;
  block-size: 100vh;
  padding: var(--ui-space-3);
  background: var(--ui-color-surface);
  border-inline-end: 1px solid var(--ui-color-border);
}
.ui-console__side[data-open='true'] {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  display: flex;
  box-shadow: var(--ui-elevation-3);
}
@media (min-width: 1024px) {
  .ui-console__side {
    display: flex;
  }
  .ui-console__menu {
    display: none;
  }
}
.ui-console__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-2);
}
.ui-console__tag {
  padding: 0 var(--ui-space-2);
  background: var(--ui-color-surface-subtle);
  border-radius: var(--ui-radius-sm);
  color: var(--ui-color-text-secondary);
}
.ui-console__account {
  margin-block-start: auto;
  padding: var(--ui-space-1);
  background: var(--ui-color-surface-page);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-lg);
}
.ui-console__account-btn {
  justify-content: flex-start;
}
.ui-console__account-inner {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  text-align: start;
}
.ui-console__who {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}
.ui-console__name,
.ui-console__role {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-console__role {
  color: var(--ui-color-text-hint);
  font-weight: 400;
}
.ui-console__frame {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}
.ui-console__header {
  position: sticky;
  inset-block-start: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  padding: var(--ui-space-3) var(--ui-space-8);
  background: color-mix(in srgb, var(--ui-color-surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-console__search {
  flex: 1;
  max-inline-size: 400px;
}
.ui-console__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  margin-inline-start: auto;
}
.ui-console__main {
  flex: 1;
  inline-size: 100%;
  max-inline-size: 1280px;
  margin-inline: auto;
  padding: var(--ui-space-8);
}
.ui-console__main:focus {
  outline: none;
}
@media (max-width: 767px) {
  .ui-console__header {
    padding-inline: var(--ui-space-4);
  }
  .ui-console__main {
    padding: var(--ui-space-5) var(--ui-space-4);
  }
}
</style>
