<script setup lang="ts">
import { uiText } from '../composables/useUiText';
import UiLink from './UiLink.vue';
import UiSelect from './UiSelect.vue';
import UiSkipLink from './UiSkipLink.vue';

/**
 * Public participant page frame (UI-PUB-01, UI-PUB-23): brand and language switcher on top, a
 * single reading column, and a footer that always has Privacy, Terms, Help and Report abuse (the
 * help link is in the same place on every public page). The language switcher appears only when the
 * campaign has more than one locale. Rendered by SSR and edge-cached: it holds no per-user data.
 */
const props = withDefaults(
  defineProps<{
    brandName: string;
    locale?: string;
    locales?: Array<{ value: string; label: string }>;
    links?: { privacy: string; terms: string; help: string; reportAbuse: string };
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
      <UiSelect
        v-if="locales && locales.length > 1"
        :model-value="props.locale ?? ''"
        :label="uiText('public.language')"
        :options="locales"
        @update:model-value="emit('update:locale', $event)"
      />
    </header>
    <main id="main" tabindex="-1" class="ui-public__main ui-reading"><slot /></main>
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
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-block-end: 1px solid var(--ui-color-border);
}
.ui-public__brand {
  font-weight: 700;
  max-inline-size: 240px;
}
.ui-public__main {
  flex: 1;
  inline-size: 100%;
  padding: var(--ui-space-4);
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
