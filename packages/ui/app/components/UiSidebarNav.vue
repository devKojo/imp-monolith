<script setup lang="ts">
import type { IconName } from '../icons';
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';

export type NavItem = {
  label: string;
  to: string;
  icon?: IconName;
  current?: boolean;
  badge?: string;
};

/**
 * Primary navigation. The caller filters `items` by the user's permissions (spec 2.2, 7.3: hide
 * what a role can never do); the server still enforces access. The current page carries
 * aria-current="page". Collapsed, it shows icons only: the label stays for assistive tech and as a
 * tooltip, and a badge becomes a small dot.
 */
defineProps<{ items: NavItem[]; label?: string; collapsed?: boolean }>();
</script>

<template>
  <nav :aria-label="label ?? uiText('nav.main')" class="ui-sidenav" :data-collapsed="collapsed">
    <ul>
      <li v-for="item in items" :key="item.to">
        <UiLink
          :to="item.to"
          class="ui-sidenav__link"
          :aria-current="item.current ? 'page' : undefined"
          :data-current="item.current"
          :title="collapsed ? item.label : undefined"
        >
          <UiIcon v-if="item.icon" :name="item.icon" :size="20" />
          <span class="ui-sidenav__label" :class="{ 'ui-sr-only': collapsed }">{{ item.label }}</span>
          <span v-if="item.badge" class="ui-sidenav__badge ui-text-caption">{{ item.badge }}</span>
        </UiLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
ul {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-sidenav__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: var(--ui-space-2) var(--ui-space-3);
  color: var(--ui-color-text-primary);
  border-radius: var(--ui-radius-lg);
  text-decoration: none;
  transition: background-color 0.15s ease;
}
.ui-sidenav__link:hover {
  background: var(--ui-color-surface-subtle);
}
.ui-sidenav__link[data-current='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  font-weight: 700;
}
/* A bar on the edge marks where you are, so it reads at a glance even when only icons are shown. */
.ui-sidenav__link[data-current='true']::before {
  content: '';
  position: absolute;
  inset-block: var(--ui-space-2);
  inset-inline-start: 0;
  inline-size: 3px;
  background: currentcolor;
  border-start-end-radius: var(--ui-radius-pill);
  border-end-end-radius: var(--ui-radius-pill);
}
.ui-sidenav__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-sidenav[data-collapsed='true'] .ui-sidenav__link {
  justify-content: center;
  padding-inline: 0;
}
.ui-sidenav[data-collapsed='true'] .ui-sidenav__badge {
  position: absolute;
  inset-block-start: var(--ui-space-1);
  inset-inline-end: var(--ui-space-1);
  inline-size: var(--ui-space-2);
  block-size: var(--ui-space-2);
  padding: 0;
  overflow: hidden;
  color: transparent;
  background: var(--ui-color-surface-inverse);
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .ui-sidenav__link {
    transition: none;
  }
}
.ui-sidenav__badge {
  margin-inline-start: auto;
  padding: 0 var(--ui-space-2);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-pill);
}
</style>
