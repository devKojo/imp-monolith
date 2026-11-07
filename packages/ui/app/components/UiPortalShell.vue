<script setup lang="ts">
import UiAvatar from './UiAvatar.vue';
import UiButton from './UiButton.vue';
import UiLink from './UiLink.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Participant frame: brand and two or three tabs on the left, the signed-in person on the right,
 * one <main> landmark and a quiet footer. Participants use phones, so targets stay 44 px and the
 * tabs wrap under the brand on narrow screens.
 */
defineProps<{
  brandName: string;
  nav: Array<{ label: string; to: string; current?: boolean }>;
  userName: string;
  userStatus?: string;
  navLabel: string;
  signOutLabel: string;
}>();

const emit = defineEmits<{ signOut: [] }>();
</script>

<template>
  <div class="ui-portal">
    <UiSkipLink />
    <header class="ui-portal__header">
      <div class="ui-portal__bar">
        <slot name="brand">
          <strong class="ui-portal__brand ui-text-h3">{{ brandName }}</strong>
        </slot>
        <nav :aria-label="navLabel" class="ui-portal__nav">
          <UiLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            bare
            class="ui-portal__tab ui-text-label"
            :aria-current="item.current ? 'page' : undefined"
            :data-current="item.current"
            >{{ item.label }}</UiLink
          >
        </nav>
        <div class="ui-portal__user">
          <UiAvatar :name="userName" :verified="!!userStatus" />
          <span class="ui-portal__who">
            <span class="ui-portal__name ui-text-label">{{ userName }}</span>
            <span v-if="userStatus" class="ui-portal__status ui-text-caption">{{
              userStatus
            }}</span>
          </span>
          <UiButton variant="tertiary" icon="log-out" @click="emit('signOut')">
            <span class="ui-sr-only">{{ signOutLabel }}</span>
          </UiButton>
        </div>
      </div>
    </header>
    <main id="main" tabindex="-1" class="ui-portal__main"><slot /></main>
    <footer class="ui-portal__footer ui-text-body-s"><slot name="footer" /></footer>
  </div>
</template>

<style scoped>
.ui-portal {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
  background: var(--ui-color-surface-page);
}
.ui-portal__header {
  position: sticky;
  inset-block-start: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--ui-color-surface) 92%, transparent);
  backdrop-filter: blur(8px);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-portal__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2) var(--ui-space-6);
  inline-size: 100%;
  max-inline-size: 1104px;
  margin-inline: auto;
  padding: var(--ui-space-3) var(--ui-space-4);
}
.ui-portal__nav {
  display: flex;
  flex: 1;
  gap: var(--ui-space-1);
}
.ui-portal__tab {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-public);
  padding: 0 var(--ui-space-4);
  border-radius: var(--ui-radius-lg);
  color: var(--ui-color-text-secondary);
  text-decoration: none;
}
.ui-portal__tab:hover {
  background: var(--ui-color-surface-hover);
  color: var(--ui-color-text-primary);
}
.ui-portal__tab[data-current='true'] {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  font-weight: 700;
}
.ui-portal__user {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}
.ui-portal__who {
  display: none;
  flex-direction: column;
}
.ui-portal__status {
  color: var(--ui-color-text-hint);
}
@media (min-width: 640px) {
  .ui-portal__who {
    display: flex;
  }
}
.ui-portal__main {
  flex: 1;
  inline-size: 100%;
  max-inline-size: 1104px;
  margin-inline: auto;
  padding: var(--ui-space-10) var(--ui-space-4);
}
.ui-portal__main:focus {
  outline: none;
}
.ui-portal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-6) var(--ui-space-4);
  background: var(--ui-color-surface);
  border-block-start: 1px solid var(--ui-color-border);
  color: var(--ui-color-text-secondary);
}
</style>
