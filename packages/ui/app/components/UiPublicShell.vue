<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiIcon from './UiIcon.vue';
import UiLink from './UiLink.vue';
import UiSelect from './UiSelect.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Public page frame (UI-PUB-01, UI-PUB-23): brand on top, optional primary navigation and header
 * actions (for example Sign in), a language switcher when there is more than one locale, and a
 * footer that always has Privacy, Terms, Help and Report abuse. The help link is in the same place
 * on every public page. `wide` replaces the 720 px reading column with the full content width for
 * listings. Rendered by SSR and edge-cached: it holds no per-user data.
 */
const props = withDefaults(
  defineProps<{
    brandName: string;
    locale?: string;
    locales?: Array<{ value: string; label: string }>;
    links?: { privacy: string; terms: string; help: string; reportAbuse: string };
    /** Full content width instead of the reading column. */
    wide?: boolean;
  }>(),
  {
    links: () => ({
      privacy: '/privacy',
      terms: '/terms',
      help: '/help',
      reportAbuse: '/report-abuse',
    }),
  },
);
const emit = defineEmits<{ 'update:locale': [locale: string] }>();
</script>

<template>
  <div class="ui-public">
    <UiSkipLink />
    <header class="ui-public__header">
      <div class="ui-public__brand">
        <slot name="logo">
          <span class="ui-public__mark" aria-hidden="true"><UiIcon name="zap" :size="18" /></span>
          <span class="ui-public__name">{{ brandName }}</span>
        </slot>
      </div>
      <nav v-if="$slots.nav" class="ui-public__nav" :aria-label="uiText('nav.primary')">
        <slot name="nav" />
      </nav>
      <div class="ui-public__actions">
        <slot name="actions" />
        <UiSelect
          v-if="locales && locales.length > 1"
          :model-value="props.locale ?? ''"
          :label="uiText('public.language')"
          :options="locales"
          @update:model-value="emit('update:locale', $event)"
        />
      </div>
    </header>
    <main
      id="main"
      tabindex="-1"
      class="ui-public__main"
      :class="wide ? 'ui-public__main--wide' : 'ui-reading'"
    >
      <slot />
    </main>
    <footer class="ui-public__footer">
      <p class="ui-public__footer-brand">
        <span class="ui-public__mark ui-public__mark--sm" aria-hidden="true">
          <UiIcon name="zap" :size="14" />
        </span>
        {{ brandName }}
      </p>
      <nav :aria-label="uiText('nav.footer')">
        <ul>
          <li>
            <UiLink :to="links.privacy">{{ uiText('public.privacy') }}</UiLink>
          </li>
          <li>
            <UiLink :to="links.terms">{{ uiText('public.terms') }}</UiLink>
          </li>
          <li>
            <UiLink :to="links.help">{{ uiText('public.help') }}</UiLink>
          </li>
          <li>
            <UiLink :to="links.reportAbuse">{{ uiText('public.reportAbuse') }}</UiLink>
          </li>
        </ul>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.ui-public {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
}
/* Sticky frosted header: content scrolls underneath it. */
.ui-public__header {
  position: sticky;
  inset-block-start: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2) var(--ui-space-5);
  padding: var(--ui-space-2)
    max(var(--ui-space-4), calc((100% - var(--ui-layout-content-max)) / 2 + var(--ui-space-8)));
  background: color-mix(in srgb, var(--ui-color-surface-page) 82%, transparent);
  border-block-end: 1px solid var(--ui-color-border);
  box-shadow: var(--ui-elevation-1);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  backdrop-filter: saturate(180%) blur(16px);
}
.ui-public__brand {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  max-inline-size: 280px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.ui-public__name {
  font-size: var(--ui-font-body-s-size);
}
.ui-public__mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: var(--ui-space-8);
  block-size: var(--ui-space-8);
  background: linear-gradient(
    145deg,
    var(--ui-color-action-primary),
    var(--ui-color-action-primary-hover)
  );
  color: var(--ui-color-action-primary-text);
  border-radius: var(--ui-radius-lg);
  box-shadow: var(--ui-elevation-1);
}
.ui-public__mark--sm {
  inline-size: var(--ui-space-6);
  block-size: var(--ui-space-6);
  border-radius: var(--ui-radius-md);
}
.ui-public__nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}
/* Navigation links read as nav items, not inline text links; the current page is marked. */
.ui-public__nav :deep(a) {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-public);
  padding-inline: var(--ui-space-4);
  color: var(--ui-color-text-secondary);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-body-s-size);
  font-weight: 500;
  text-decoration: none;
  transition: background var(--ui-motion-fast) ease;
}
.ui-public__nav :deep(a:hover) {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-text-primary);
}
.ui-public__nav :deep(a[aria-current='page']) {
  background: var(--ui-color-selected-bg);
  color: var(--ui-color-selected-text);
  font-weight: 600;
}
.ui-public__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-inline-start: auto;
}
.ui-public__main {
  flex: 1;
  inline-size: 100%;
  padding: var(--ui-space-4);
}
.ui-public__main--wide {
  max-inline-size: none;
  padding: 0;
}
.ui-public__main:focus {
  outline: none;
}
.ui-public__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3) var(--ui-space-6);
  padding: var(--ui-space-6)
    max(var(--ui-space-4), calc((100% - var(--ui-layout-content-max)) / 2 + var(--ui-space-8)));
  background: var(--ui-color-surface-subtle);
  border-block-start: 1px solid var(--ui-color-border);
}
.ui-public__footer-brand {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin: 0;
  font-size: var(--ui-font-body-s-size);
  font-weight: 600;
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1) var(--ui-space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}
li a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-public);
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-body-s-size);
  text-decoration: none;
}
li a:hover {
  color: var(--ui-color-text-primary);
}
</style>
