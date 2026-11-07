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
 * aria-current="page".
 */
defineProps<{ items: NavItem[]; label?: string }>();
</script>

<template>
  <nav :aria-label="label ?? uiText('nav.main')" class="ui-sidenav">
    <ul>
      <li v-for="item in items" :key="item.to">
        <UiLink
          :to="item.to"
          class="ui-sidenav__link"
          :aria-current="item.current ? 'page' : undefined"
          :data-current="item.current"
        >
          <UiIcon v-if="item.icon" :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
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
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  min-block-size: var(--ui-control-target, var(--ui-target-dashboard));
  padding: var(--ui-space-2) var(--ui-space-3);
  color: var(--ui-color-text-primary);
  border-radius: var(--ui-radius-md);
  text-decoration: none;
}
.ui-sidenav__link:hover {
  background: var(--ui-color-surface-subtle);
}
.ui-sidenav__link[data-current='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  font-weight: 700;
}
.ui-sidenav__badge {
  margin-inline-start: auto;
  padding: 0 var(--ui-space-2);
  background: var(--ui-color-surface-subtle);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-pill);
}
</style>
