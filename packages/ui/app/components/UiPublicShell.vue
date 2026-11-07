<script setup lang="ts">
import { uiText } from '../composables/useUiText';
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
        <slot name="logo">{{ brandName }}</slot>
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
.ui-public__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3) var(--ui-space-5);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-public__brand {
  font-weight: 700;
  max-inline-size: 240px;
}
.ui-public__nav {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: var(--ui-space-1) var(--ui-space-2);
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
  max-inline-size: var(--ui-layout-content-max);
  margin-inline: auto;
}
.ui-public__main:focus {
  outline: none;
}
.ui-public__footer {
  padding: var(--ui-space-4);
  background: var(--ui-color-surface-subtle);
  border-block-start: 1px solid var(--ui-color-border);
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2) var(--ui-space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}
li a {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--ui-target-public);
}
</style>
